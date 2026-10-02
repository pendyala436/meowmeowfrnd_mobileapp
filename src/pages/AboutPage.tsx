import { useEffect } from "react";
import { PublicInfoLayout } from "@/components/PublicInfoLayout";
import { Link } from "react-router-dom";
import { absoluteUrl, SITE_LOGO, SITE_NAME, SITE_ORIGIN } from "@/lib/site";
import { HOME_DESCRIPTION, KNOWS_ABOUT_TOPICS } from "@/lib/seo-keywords";

export default function AboutPage() {
  useEffect(() => {
    const scriptId = "about-jsonld";
    document.getElementById(scriptId)?.remove();
    const data = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_ORIGIN}/#organization`,
          name: SITE_NAME,
          url: absoluteUrl("/"),
          logo: {
            "@type": "ImageObject",
            url: SITE_LOGO,
          },
          description: HOME_DESCRIPTION,
          areaServed: "IN",
          knowsAbout: [...KNOWS_ABOUT_TOPICS],
        },
        {
          "@type": "SoftwareApplication",
          "@id": `${SITE_ORIGIN}/#software`,
          name: SITE_NAME,
          url: absoluteUrl("/"),
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Web, Android, iOS",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "INR",
          },
          description: HOME_DESCRIPTION,
          featureList: [
            "Make friends online",
            "Private chat messaging",
            "Voice and video calls",
            "Language-aware matching",
            "Safety tools (report & block)",
          ],
          publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        },
        {
          "@type": "AboutPage",
          "@id": absoluteUrl("/about"),
          url: absoluteUrl("/about"),
          name: `About ${SITE_NAME}`,
          isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
          about: { "@id": `${SITE_ORIGIN}/#organization` },
        },
      ],
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
      title="About Meow Meow Frnd App"
      subtitle="A social friendship app to meet new people online, make genuine connections, and chat safely with voice and video."
    >
      <section>
        <h2 className="text-lg font-semibold mb-2">Who we are</h2>
        <p>
          Meow Meow Frnd App helps you make friends online and meet like-minded people. Register,
          verify your profile, discover people who share your language, and build meaningful
          friendships through private chat, voice conversations, and video calls — on the web or as
          an installable mobile app (PWA / Android).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">What makes us different</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Friendship-first: genuine connections and respectful conversations.</li>
          <li>
            Meet compatible people with language-aware matching across Indian languages and English.
          </li>
          <li>Chat, voice chat, and video chat in one safe social app.</li>
          <li>Safety tools: reporting, blocking, moderation, and verification steps.</li>
          <li>Works as a Progressive Web App and native Android package via Capacitor.</li>
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
        <h2 className="text-lg font-semibold mb-2">Official links</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Website:{" "}
            <a className="underline" href={absoluteUrl("/")}>
              {SITE_ORIGIN}
            </a>
          </li>
          <li>
            AI / crawler summary:{" "}
            <a className="underline" href={absoluteUrl("/llms.txt")}>
              llms.txt
            </a>
          </li>
          <li>
            Sitemap:{" "}
            <a className="underline" href={absoluteUrl("/sitemap.xml")}>
              sitemap.xml
            </a>
          </li>
        </ul>
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
