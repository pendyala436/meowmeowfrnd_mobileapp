import { PublicInfoLayout } from "@/components/PublicInfoLayout";
import { Link } from "react-router-dom";

export default function HowItWorksPage() {
  return (
    <PublicInfoLayout
      title="How to Make Friends Online with Meow Meow Frnd"
      subtitle="A simple path to meet new people, start conversations, and build genuine friendships — safely."
    >
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Create your account</h2>
        <p>
          Start at the sign-in page, choose your language and country, then complete basic profile
          details. Depending on your path, you may complete captcha, gender verification, photo
          upload, and terms agreement before entering the friendship app.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. Verify for a safer community</h2>
        <p>
          Verification steps help keep online connections safer. Some profiles may wait for approval
          before full access. Follow on-screen guidance until your dashboard unlocks.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. Discover like-minded people</h2>
        <p>
          Use matching and discovery to meet people who share your language preferences. Online
          status and filters help you find friends who are available to chat now.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">4. Chat, voice & video</h2>
        <p>
          Start private messaging, then connect with voice chat or video chat when you are both
          ready. Private group call rooms may be available when enabled. Keep conversations
          respectful — harassment, scams, and sharing personal contacts outside the app may be
          moderated.
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
        <h2 className="text-lg font-semibold mb-2">6. Install the app</h2>
        <p>
          Prefer a home-screen icon? Visit the{" "}
          <Link className="underline" to="/install">
            install guide
          </Link>{" "}
          for Android, iOS, and desktop PWA instructions — a modern way to keep your friendship
          community one tap away.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Next steps</h2>
        <p>
          Questions about how to meet people online safely? See the{" "}
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
          </Link>{" "}
          and start making friends.
        </p>
      </section>
    </PublicInfoLayout>
  );
}
