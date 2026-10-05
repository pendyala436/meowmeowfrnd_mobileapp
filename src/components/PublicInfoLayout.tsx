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
  { to: "/blog/", label: "Blog", external: true as const },
  { to: "/install", label: "Install" },
  { to: "/auth", label: "Sign in" },
] as const;

interface PublicInfoLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

function NavLink({ to, label, external }: { to: string; label: string; external?: boolean }) {
  const className =
    "text-muted-foreground hover:text-foreground underline-offset-2 hover:underline";
  if (external) {
    return (
      <a href={to} className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {label}
    </Link>
  );
}

export function PublicInfoLayout({ title, subtitle, children, className }: PublicInfoLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 sticky top-0 z-10 bg-primary/15 backdrop-blur supports-[backdrop-filter]:bg-primary/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <MeowLogo size="sm" className="!w-10 !h-10 shrink-0" priority />
            <span className="font-semibold truncate text-sm sm:text-base text-foreground">
              {SITE_NAME}
            </span>
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1 text-xs sm:text-sm text-primary hover:underline shrink-0 font-medium"
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
            <NavLink
              key={item.to}
              to={item.to}
              label={item.label}
              external={"external" in item ? item.external : false}
            />
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
              <NavLink
                key={`f-${item.to}`}
                to={item.to}
                label={item.label}
                external={"external" in item ? item.external : false}
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicInfoLayout;
