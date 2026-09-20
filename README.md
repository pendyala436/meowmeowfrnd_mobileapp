# Meow Meow Frnd App

Real-time social matching app: chat, calls, gifts, KYC/payouts, and admin tools.

| | |
|---|---|
| **Package** | `in.co.meowmeow` |
| **Display name** | Meow Meow Frnd App |
| **Web** | React + Vite + Capacitor (this repo) |
| **Live site** | `https://www.meow-meow.co.in` |
| **Backend** | Self-hosted Supabase (`https://www.meow-meow.co.in:8443`) |

---

## If you are the new developer

**Ask the client for this file before you build or upload any Android release:**

> **`MeowMeow-android-signing-backup.zip`**  
> Sent by the **initial developer** for this project’s **Android Play Store signing**.

That zip is **not** in Git. Without it you cannot sign updates that Play will accept for `in.co.meowmeow`. Generating a new keystore will **break** the listing — users cannot update.

The zip contains:

| File | Purpose |
|------|---------|
| `android.keystore` | Upload / release signing key |
| `keystore.properties` | Alias + passwords used by Gradle |

Keep it **off GitHub**, off shared drives with public links, and in private storage only.

---

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, shadcn/ui
- **Mobile shell:** Capacitor 7 (Android). Web UI is bundled into the APK/AAB.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **Payments:** Razorpay Orders + `checkout.js` (see `docs/RAZORPAY_INTEGRATION.md`)

Deeper docs live in [`docs/`](./docs/README.md).

---

## Local setup

**Need:** Node.js + npm, Python 3 (branding/version scripts), JDK **21** for Android builds (Homebrew `openjdk@21` on macOS). Gradle 8.11 cannot run on JDK 25.

```bash
git clone <repo-url>
cd new_project   # or your checkout name
npm install
cp .env.example .env   # if present; otherwise copy existing .env from the client
npm run dev
```

Frontend env (typical):

```
VITE_SUPABASE_URL=https://www.meow-meow.co.in:8443
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=supabase
```

Do not commit `.env` or signing files.

---

## Restore Android signing

1. Get **`MeowMeow-android-signing-backup.zip`** from the client (from the initial dev).
2. Unzip it.
3. Copy files into this repo:

```text
android.keystore          →  rajeshrajesh/android.keystore
keystore.properties       →  android/keystore.properties
```

4. Confirm `android/keystore.properties` has:

```properties
storeFile=../rajeshrajesh/android.keystore
keyAlias=android
```

5. These paths are **gitignored**. Do not `git add` them.

`android/app/build.gradle` loads `android/keystore.properties` for the **release** signing config. If the properties file is missing, release builds will not be signed for Play.

---

## Create a new signing backup (current machine)

Only if you already have the key on this machine and the client needs a copy:

```bash
WORKDIR=$(mktemp -d)
cp rajeshrajesh/android.keystore "$WORKDIR/android.keystore"
cp android/keystore.properties "$WORKDIR/keystore.properties"
cd "$WORKDIR"
zip -X -r ~/Desktop/MeowMeow-android-signing-backup.zip android.keystore keystore.properties
```

Send the zip **privately**. Share any zip password on a different channel.

---

## Web deploy

1. `npm run build` → output in `dist/`
2. Publish `dist/` to the production host that serves `https://www.meow-meow.co.in` (same origin as the PWA / Capacitor `webDir`).
3. Edge functions and DB live on the self-hosted Supabase host. Secrets (Razorpay, etc.) stay in the server `.env` — not in this frontend repo.

Razorpay webhook (example):

`https://<SUPABASE_HOST>/functions/v1/razorpay-webhook`

See `docs/DEPLOYMENT.md` and `docs/RAZORPAY_INTEGRATION.md`.

---

## Android build & Play upload

`build:apk` and `build:aab` always:

1. Bump `versionCode` +1 and `versionName` patch +1 in `android/app/build.gradle`
2. Refresh PWA/branding icons
3. Vite production build
4. `npx cap sync android`
5. Clean Gradle release assemble / bundle (offline cache, JDK 21)

```bash
# Installable APK (sideload / testers)
npm run build:apk

# Play Store bundle
npm run build:aab
```

Outputs:

| Artifact | Path |
|----------|------|
| APK | `android/app/build/outputs/apk/release/MeowMeow-vX.Y.Z.apk` |
| AAB | `android/app/build/outputs/bundle/release/MeowMeow-vX.Y.Z.aab` |

Do **not** run `apk:assemble` / `aab:bundle` alone if you changed web/UI — they skip the Vite build and Capacitor sync.

Upload the **AAB** to Google Play Console for `in.co.meowmeow`. `versionCode` must be higher than the last published build.

### Gradle / Java notes

- Use **JDK 21** (scripted in `package.json`).
- `GRADLE_USER_HOME` must be `~/.gradle` so Gradle is not re-downloaded every time.
- `--offline` uses the local Gradle cache (no extra downloads if deps are already there).

---

## Other scripts

| Script | What it does |
|--------|----------------|
| `npm run bump:android-version` | Bump Android version only |
| `npm run generate:pwa-branding` | Rebuild icons from the circular logo |
| `npm run generate:play-store` | Play listing graphics |
| `npm test` / `npm run test:run` | Vitest |

---

## What never goes in Git

- `*.keystore`, `*.jks`
- `android/keystore.properties`
- `.env` and server secrets
- `MeowMeow-android-signing-backup.zip`

---

## Roles (product)

| Role | Notes |
|------|--------|
| Men | Wallet recharge (Razorpay), paid chat/calls |
| Women | Earnings, Bank KYC, optional Team Lead |
| Admin | `/admin/*` — users, KYC, payouts, settings |
