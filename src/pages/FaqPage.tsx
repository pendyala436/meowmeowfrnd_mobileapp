import { useEffect } from "react";
import { PublicInfoLayout } from "@/components/PublicInfoLayout";
import { Link } from "react-router-dom";
import { absoluteUrl } from "@/lib/site";

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "What is Meow Meow Frnd App?",
    a: "Meow Meow Frnd is a friendship and social chat app where you can meet new people online, make friends, and connect through private text chat, voice calls, and video calls after creating a verified profile.",
  },
  {
    q: "How do I make friends online with Meow Meow Frnd?",
    a: "Create an account, complete verification steps, set your language preferences, then use matching and discovery to find like-minded people. Start a conversation with chat, or connect by voice or video when both people are ready.",
  },
  {
    q: "How do I meet new people online safely?",
    a: "Stay inside the app for conversations, never share OTPs, bank details, or government IDs, and use Report and Block if someone pressures you to move to WhatsApp or Telegram. Meow Meow Frnd includes moderation and safety tools for safer online connections.",
  },
  {
    q: "Is this a dating app or a friendship app?",
    a: "Meow Meow Frnd is built as a friend-making and social connection platform — meaningful conversations, chat, and calls with people who share your language. Focus on genuine friendships and respectful community behaviour.",
  },
  {
    q: "Can I chat, voice call, and video call?",
    a: "Yes. You can use one-to-one text chat, voice chat, and video chat with friends you connect with in the app. Private messaging and live conversations stay inside Meow Meow Frnd when features are enabled.",
  },
  {
    q: "How do I meet like-minded people?",
    a: "Language-aware matching helps you discover people who share a language preference. That makes it easier to find compatible conversation partners and build meaningful friendships.",
  },
  {
    q: "Is Meow Meow Frnd free to use?",
    a: "Creating an account and using many social features is free. Some chat or call features may require wallet balance according to the in-app rate card. Women may earn virtual coins from eligible activity.",
  },
  {
    q: "Which languages are supported?",
    a: "The app supports major Indian languages (such as Hindi, Bengali, Telugu, Marathi, Tamil, and others) plus English for profiles and call matching — so you can find friends who speak your language.",
  },
  {
    q: "How do I install the friendship app on my phone?",
    a: "Open the Install page and follow Android or iOS PWA steps to add Meow Meow Frnd to your home screen. An Android package (AAB/APK) may also be available through official channels.",
  },
  {
    q: "How does online friendship work on Meow Meow Frnd?",
    a: "Register, verify, get matched or discover people, then start chatting. Build genuine connections through respectful conversations — text, voice, or video — and use safety tools whenever you need them.",
  },
  {
    q: "I forgot my password. What should I do?",
    a: "Use Forgot Password on the sign-in screen. You will receive reset instructions if your email is registered.",
  },
  {
    q: "Where can I get help?",
    a: "Use in-app admin messaging when available, or review About and Terms. For account issues, contact support through the channels listed in the app legal documents.",
  },
];

export default function FaqPage() {
  useEffect(() => {
    const scriptId = "faq-jsonld";
    document.getElementById(scriptId)?.remove();
    const data = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
      url: absoluteUrl("/faq"),
    };
    const el = document.createElement("script");
    el.id = scriptId;
    el.type = "application/ld+json";
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, []);

  return (
    <PublicInfoLayout
      title="Frequently Asked Questions"
      subtitle="How to make friends online, meet new people safely, chat and call, and get the most from Meow Meow Frnd."
    >
      <div className="space-y-6">
        {FAQS.map((item) => (
          <section key={item.q} className="border-b border-border/50 pb-4">
            <h2 className="text-base sm:text-lg font-semibold mb-2">{item.q}</h2>
            <p>{item.a}</p>
          </section>
        ))}
      </div>

      <p className="pt-4">
        Still curious? Read{" "}
        <Link className="underline" to="/how-it-works">
          how it works
        </Link>{" "}
        or{" "}
        <Link className="underline" to="/about">
          about the app
        </Link>
        .{" "}
        <Link className="underline" to="/auth">
          Sign in
        </Link>{" "}
        when you are ready.
      </p>
    </PublicInfoLayout>
  );
}
