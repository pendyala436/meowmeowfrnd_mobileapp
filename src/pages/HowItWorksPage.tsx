import { PublicInfoLayout } from "@/components/PublicInfoLayout";
import { Link } from "react-router-dom";

export default function HowItWorksPage() {
  return (
    <PublicInfoLayout
      title="How Meow Meow Frnd Works"
      subtitle="From signup to your first conversation — a simple path designed for safety and clarity."
    >
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Create your account</h2>
        <p>
          Start at the sign-in page, choose your language and country, then complete basic profile
          details. Depending on your path, you may complete captcha, gender verification, photo
          upload, and terms agreement before entering the app.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. Verify & get approved</h2>
        <p>
          Verification steps help keep the community safer. Some profiles may wait for approval
          before full access. Follow on-screen guidance until your dashboard unlocks.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. Discover people</h2>
        <p>
          Use matching and discovery tools to find people who share your language preferences.
          Online status and filters help you start conversations with people who are available now.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">4. Chat, audio & video</h2>
        <p>
          Message one-to-one, send media where allowed, or place audio and video calls. Private
          group call rooms are available when enabled by settings. Always follow community rules —
          harassment, scams, and sharing personal contact details outside the app may be moderated.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">5. Wallet & earnings</h2>
        <p>
          Men may recharge a wallet for paid features. Women may earn virtual coins from eligible
          activity according to the in-app rate card. Balances and statements are visible in the
          wallet screens.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">6. Install on your phone</h2>
        <p>
          Prefer an app icon on your home screen? Visit the{" "}
          <Link className="underline" to="/install">
            install guide
          </Link>{" "}
          for Android, iOS, and desktop PWA instructions.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Next steps</h2>
        <p>
          Questions? See the{" "}
          <Link className="underline" to="/faq">
            FAQ
          </Link>
          . Want the company story? Read{" "}
          <Link className="underline" to="/about">
            About
          </Link>
          . Otherwise{" "}
          <Link className="underline" to="/auth">
            open the app
          </Link>
          .
        </p>
      </section>
    </PublicInfoLayout>
  );
}
