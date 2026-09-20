import { useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";
import meowLogoCircle from "@/assets/meow-logo-circle.png";
import { useAppTheme } from "@/contexts/ThemeContext";

interface MeowLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/** Dominant hue of the source pink logo art (degrees). */
const LOGO_BASE_HUE = 335;

function readPrimaryHue(): number {
  if (typeof document === "undefined") return LOGO_BASE_HUE;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  const hue = parseFloat(raw);
  return Number.isFinite(hue) ? hue : LOGO_BASE_HUE;
}

/**
 * Official circular brand mark — transparent outside the circle.
 * Recolors to the active theme primary via hue-rotate from the pink source art.
 */
const MeowLogo = ({ className, size = "md" }: MeowLogoProps) => {
  const { themeId, resolvedMode } = useAppTheme();
  const [primaryHue, setPrimaryHue] = useState(LOGO_BASE_HUE);

  useLayoutEffect(() => {
    setPrimaryHue(readPrimaryHue());
  }, [themeId, resolvedMode]);

  const hueRotate = ((primaryHue - LOGO_BASE_HUE) % 360 + 360) % 360;

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
        src={meowLogoCircle}
        alt="Meow Meow Friend App"
        className="h-full w-full object-contain select-none pointer-events-none"
        draggable={false}
        style={{ filter: `hue-rotate(${hueRotate}deg)` }}
      />
    </div>
  );
};

export default MeowLogo;
