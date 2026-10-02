/**
 * Shared chrome for public marketing / SEO pages (About, FAQ, How it works).
 */
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import MeowLogo from "@/components/MeowLogo";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/about", label: "About" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/faq", label: "FAQ" },
  { to: "/install", label: "Install" },
  { to: "/auth", label: "Sign in" },
] as const;

interface PublicInfoLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function PublicInfoLayout({ title, subtitle, children, className }: PublicInfoLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <MeowLogo className="h-8 w-8 shrink-0" />
            <span className="font-semibold truncate text-sm sm:text-base">{SITE_NAME}</span>
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1 text-xs sm:text-sm text-primary-foreground/90 hover:underline shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            App
          </Link>
        </div>
        <nav
          className="max-w-3xl mx-auto px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm"
          aria-label="Public pages"
        >
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className={cn("max-w-3xl mx-auto px-4 py-8 sm:py-12", className)}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{title}</h1>
        {subtitle ? (
          <p className="text-muted-foreground text-sm sm:text-base mb-8 leading-relaxed">
            {subtitle}
          </p>
        ) : (
          <div className="mb-8" />
        )}
        <div className="prose-seo space-y-6 text-sm sm:text-base leading-relaxed">{children}</div>
      </main>

      <footer className="border-t border-border/60 mt-8">
        <div className="max-w-3xl mx-auto px-4 py-6 text-xs text-muted-foreground flex flex-wrap gap-3 justify-between">
          <span>
            © {new Date().getFullYear()} {SITE_NAME}
          </span>
          <div className="flex flex-wrap gap-3">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="hover:underline">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicInfoLayout;
