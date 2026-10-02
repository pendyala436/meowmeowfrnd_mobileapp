import { PublicInfoLayout } from "@/components/PublicInfoLayout";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <PublicInfoLayout
      title="About Meow Meow Frnd App"
      subtitle="A friend-making platform built for real conversations — chat, audio, and video — with safety and language matching at the centre."
    >
      <section>
        <h2 className="text-lg font-semibold mb-2">Who we are</h2>
        <p>
          Meow Meow Frnd App helps people find meaningful friendships online. Users can register,
          verify their profile, match with others who share a language, and connect through text
          chat, voice calls, and video calls on the web or as an installable mobile app (PWA /
          Android).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">What makes us different</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Focus on friendship and conversation, not anonymous spam.</li>
          <li>Language-aware matching across major Indian languages and English.</li>
          <li>Built-in safety tools: reporting, blocking, moderation, and verification steps.</li>
          <li>Works as a Progressive Web App and native Android package via Capacitor.</li>
          <li>Transparent wallet and billing for paid call/chat features where applicable.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Platform & technology</h2>
        <p>
          The service runs on a modern React + TypeScript web app with Supabase for authentication,
          data, and realtime features, hosted on Linux/Ubuntu infrastructure. We continuously
          improve performance, accessibility, and trust & safety.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Learn more</h2>
        <p>
          Read{" "}
          <Link className="underline" to="/how-it-works">
            how it works
          </Link>
          , browse the{" "}
          <Link className="underline" to="/faq">
            FAQ
          </Link>
          , or{" "}
          <Link className="underline" to="/install">
            install the app
          </Link>
          . Ready to join?{" "}
          <Link className="underline" to="/auth">
            Sign in or create an account
          </Link>
          .
        </p>
      </section>
    </PublicInfoLayout>
  );
}
