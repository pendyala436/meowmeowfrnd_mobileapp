# Razorpay Integration — Meow Meow Frnd App

**App / merchant context:** Wallet recharge for men (INR).  
**Integration type:** **Orders API + Standard Checkout (`checkout.js`)** — **not** Payment Links / `razorpay.me`.  
**Platforms:** Web + Capacitor Android WebView (`in.co.meowmeow`).

---

## Flow overview

1. Client calls backend → **create Order** (`POST https://api.razorpay.com/v1/orders`).
2. Client opens **Razorpay Standard Checkout** with `order_id` + `key`.
3. On success, client sends `razorpay_order_id` / `razorpay_payment_id` / `razorpay_signature` → backend **verify**.
4. Backend validates HMAC signature, confirms order is `paid`, credits wallet (idempotent).
5. **Webhook** (`payment.captured` / `order.paid`) is a safety net for the same credit.

---

## Endpoints & env

| Item | Value |
|------|--------|
| Create / verify function | `razorpay-payment` (Supabase Edge Function) |
| Webhook function | `razorpay-webhook` |
| Webhook URL (example) | `https://<YOUR_HOST>/functions/v1/razorpay-webhook` |
| Checkout script | `https://checkout.razorpay.com/v1/checkout.js` |
| Env secrets | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |

---

## 1) Create Order (server)

`POST` Orders API with Basic auth. Amount is **gross** (wallet + 3% fee), in **paise**.

```ts
const GATEWAY_FEE_RATE = 0.03;
const walletAmount = Number(body.amount); // INR the user wants credited
const grossAmount = Math.ceil(walletAmount * (1 + GATEWAY_FEE_RATE) * 100) / 100;

const auth = "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`);
const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
  method: "POST",
  headers: { Authorization: auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    amount: Math.round(grossAmount * 100), // paise
    currency: "INR",
    receipt: `wal_${userId.slice(0, 8)}_${Date.now()}`.slice(0, 40),
    notes: {
      user_id: userId,
      purpose: "wallet_recharge",
      wallet_amount: String(walletAmount),
      gross_amount: String(grossAmount),
      fee_amount: String(grossAmount - walletAmount),
      fee_rate: String(GATEWAY_FEE_RATE),
    },
  }),
});

const order = await orderRes.json(); // { id: "order_..." }
// Return to client: { orderId: order.id, keyId: KEY_ID, walletAmount, grossAmount }
```

---

## 2) Open Standard Checkout (client — `checkout.js`)

```ts
// 1) Create order via our backend
const { data } = await supabase.functions.invoke("razorpay-payment", {
  body: { amount: amountINR, userId: session.user.id },
});

// 2) Load checkout.js
await new Promise<boolean>((resolve) => {
  if ((window as any).Razorpay) return resolve(true);
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.head.appendChild(script);
});

// 3) Open Checkout with order_id
const rzp = new (window as any).Razorpay({
  key: data.keyId,
  amount: Math.round(Number(data.grossAmount) * 100),
  currency: "INR",
  name: "Wallet Recharge",
  description: `₹${data.walletAmount} to wallet (+ fee)`,
  order_id: data.orderId,
  // Required for Capacitor / Android WebView UPI intents
  webview_intent: true,
  handler: async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    await supabase.functions.invoke("razorpay-payment", {
      body: {
        action: "verify",
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      },
    });
  },
  modal: {
    ondismiss: () => {
      /* user closed checkout */
    },
  },
  theme: { color: "#25D366" },
});

rzp.on("payment.failed", (resp: any) => {
  console.error("[Razorpay Failed]", resp?.error);
});

rzp.open();
```

---

## 3) Verify payment signature (server)

HMAC-SHA256 of `order_id|payment_id` with `RAZORPAY_KEY_SECRET`, then confirm order status via Orders API.

```ts
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const orderId = body.razorpay_order_id;
const paymentId = body.razorpay_payment_id;
const signature = body.razorpay_signature;

const expected = await hmacSha256Hex(KEY_SECRET, `${orderId}|${paymentId}`);
if (expected !== signature) {
  throw new Error("Invalid signature");
}

const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
  headers: { Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`) },
});
const order = await orderRes.json();
if (order.status !== "paid") {
  throw new Error("Order not paid");
}

// Credit wallet with notes.wallet_amount (net), not gross order.amount
```

---

## 4) Webhook (server-to-server safety net)

**Header:** `X-Razorpay-Signature`  
**Events handled:** `payment.captured`, `order.paid`

```ts
const signature = req.headers.get("x-razorpay-signature") ?? "";
const raw = await req.text();
const expected = await hmacSha256Hex(RAZORPAY_WEBHOOK_SECRET, raw);
if (expected !== signature) {
  return new Response("Invalid signature", { status: 400 });
}

const evt = JSON.parse(raw);
if (evt.event !== "payment.captured" && evt.event !== "order.paid") {
  return new Response("ignored", { status: 200 });
}

const payment = evt.payload.payment.entity;
const orderId = payment.order_id;

// Re-fetch order notes for canonical user_id + wallet_amount
const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
  headers: { Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`) },
});
const order = await orderRes.json();
const userId = order.notes?.user_id;
const walletINR = Number(order.notes?.wallet_amount);

// Idempotent wallet credit using payment.id as gateway txn id
```

Configure this URL in the Razorpay Dashboard → Webhooks, with secret = `RAZORPAY_WEBHOOK_SECRET`.

---

## 5) Android WebView notes (Capacitor)

We do **not** use a native Razorpay Android SDK. Checkout runs inside the app WebView with:

- `webview_intent: true` on Checkout options (UPI app intents)
- `allowNavigation` for `*.razorpay.com` / `*.razorpay.in` in `capacitor.config.ts`
- AndroidManifest `<queries>` for UPI packages / `upi` / `upiid` schemes so bank / UPI apps can open

```ts
// capacitor.config.ts (excerpt)
server: {
  allowNavigation: [
    "razorpay.com",
    "*.razorpay.com",
    "razorpay.in",
    "*.razorpay.in",
  ],
},
```

---

## What we are NOT using

- Payment Links / `razorpay.me` payment pages  
- Razorpay native Android / iOS SDKs  
- Subscriptions / Route / Smart Collect (unless added later)

---

## Source files in this repo

| Layer | Path |
|-------|------|
| Client checkout | `src/pages/DashboardScreen.tsx` (`handleRecharge`) |
| Create order + verify | `supabase/functions/razorpay-payment/index.ts` |
| Webhook | `supabase/functions/razorpay-webhook/index.ts` |
| Capacitor allowlist | `capacitor.config.ts` |
| Android UPI queries | `android/app/src/main/AndroidManifest.xml` |

---

## Support ticket note

Please treat this merchant as **Orders + Standard Checkout (`checkout.js`)**, including Android WebView with `webview_intent: true`. Any guidance that assumes Payment Links / `razorpay.me` does not apply to this integration.
