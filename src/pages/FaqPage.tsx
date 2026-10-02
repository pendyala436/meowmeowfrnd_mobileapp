import { useEffect } from "react";
import { PublicInfoLayout } from "@/components/PublicInfoLayout";
import { Link } from "react-router-dom";
import { absoluteUrl } from "@/lib/site";

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "What is Meow Meow Frnd App?",
    a: "It is a friend-making web and mobile app where people chat and call after creating a verified profile. The goal is meaningful conversation with language-aware matching.",
  },
  {
    q: "Is Meow Meow Frnd free to use?",
    a: "Creating an account and browsing many features is free. Some chat and call features may require wallet balance according to the in-app rate card. Women may earn virtual coins from eligible activity.",
  },
  {
    q: "Which languages are supported?",
    a: "The app supports major Indian languages (such as Hindi, Bengali, Telugu, Marathi, Tamil, and others) plus English for profiles and call matching.",
  },
  {
    q: "How do I install the app on my phone?",
    a: "Open the Install page in a supported browser and follow the Android or iOS PWA steps. An Android package (AAB/APK) may also be distributed via official channels when available.",
  },
  {
    q: "Are audio and video calls recorded?",
    a: "Private calls are for conversation between participants. Safety monitoring may use permitted signals such as reports and metadata. Always review the in-app Terms and Privacy Policy for the latest practices.",
  },
  {
    q: "How do I stay safe?",
    a: "Never share OTPs, bank details, or government IDs in chat. Use Report and Block if someone harasses you or asks to move to WhatsApp/Telegram. Moderators review reports.",
  },
  {
    q: "I forgot my password. What should I do?",
    a: "Use Forgot Password on the sign-in screen. You will receive reset instructions if your email is registered.",
  },
  {
    q: "Where can I get help?",
    a: "Use in-app admin messaging when available, or review About and Terms pages. For account issues, contact support through the channels listed in the app legal documents.",
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
      subtitle="Quick answers about accounts, safety, calls, payments, languages, and installing Meow Meow Frnd."
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
