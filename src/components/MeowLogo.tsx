import { useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAppTheme } from "@/contexts/ThemeContext";

interface MeowLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Mark as LCP candidate (auth hero). Default false = lazy-friendly. */
  priority?: boolean;
}

/** Dominant hue of the source pink logo art (degrees). */
const LOGO_BASE_HUE = 335;

const SIZE_PX = { sm: 48, md: 80, lg: 112 } as const;

/** Static public assets — preloadable, not hashed into a 1.4MB JS chunk */
const LOGO_SRC = {
  sm: "/icons/meow-logo-256.webp",
  md: "/icons/meow-logo-256.webp",
  lg: "/icons/meow-logo-512.webp",
} as const;

function readPrimaryHue(): number {
  if (typeof document === "undefined") return LOGO_BASE_HUE;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  const hue = parseFloat(raw);
  return Number.isFinite(hue) ? hue : LOGO_BASE_HUE;
}

/**
 * Official circular brand mark — transparent outside the circle.
 * Recolors to the active theme primary via hue-rotate from the pink source art.
 * Uses compressed WebP under /icons (not the 1.4MB master PNG) for Core Web Vitals.
 */
const MeowLogo = ({ className, size = "md", priority = false }: MeowLogoProps) => {
  const { themeId, resolvedMode } = useAppTheme();
  const [primaryHue, setPrimaryHue] = useState(LOGO_BASE_HUE);

  useLayoutEffect(() => {
    setPrimaryHue(readPrimaryHue());
  }, [themeId, resolvedMode]);

  const hueRotate = (((primaryHue - LOGO_BASE_HUE) % 360) + 360) % 360;
  const px = SIZE_PX[size];

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-28 h-28",
  };

  return (
    <div
      className={cn("relative animate-float", sizeClasses[size], className)}
      style={{
        filter:
          "drop-shadow(0 3px 8px rgba(0, 0, 0, 0.28)) drop-shadow(0 10px 20px hsl(var(--primary) / 0.28))",
      }}
      role="img"
      aria-label="Meow Meow Friend App"
    >
      <img
        src={LOGO_SRC[size]}
        alt="Meow Meow Friend App"
        width={px}
        height={px}
        className="h-full w-full object-contain select-none pointer-events-none"
        draggable={false}
        decoding={priority ? "sync" : "async"}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        style={{ filter: `hue-rotate(${hueRotate}deg)` }}
      />
    </div>
  );
};

export default MeowLogo;
