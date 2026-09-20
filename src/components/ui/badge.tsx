import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] sm:px-2.5 sm:text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-white hover:bg-primary/80 hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]",
        secondary: "border-transparent bg-secondary text-white hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-white hover:bg-destructive/80",
        outline: "text-white border-white/35 hover:border-white/50 hover:bg-white/10",
        aurora: "border-transparent gradient-aurora text-white shadow-[0_0_10px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_15px_hsl(var(--primary)/0.5)]",
        auroraOutline: "border-white/40 bg-transparent text-white hover:bg-white/10 hover:shadow-[0_0_10px_hsl(0_0%_100%/0.2)]",
        // Semantic status variants - use these for consistent theming across all 20 themes
        success: "border-transparent bg-success text-white hover:bg-success/80",
        warning: "border-transparent bg-warning text-white hover:bg-warning/80",
        info: "border-transparent bg-info text-white hover:bg-info/80",
        // Status outline variants
        successOutline: "border-success/30 bg-success/10 text-white hover:bg-success/20",
        warningOutline: "border-warning/30 bg-warning/10 text-white hover:bg-warning/20",
        infoOutline: "border-info/30 bg-info/10 text-white hover:bg-info/20",
        destructiveOutline: "border-destructive/30 bg-destructive/10 text-white hover:bg-destructive/20",
        // Online/offline status
        online: "border-online/30 bg-online/10 text-white hover:bg-online/20",
        offline: "border-offline/30 bg-offline/10 text-white hover:bg-offline/20",
        busy: "border-busy/30 bg-busy/10 text-white hover:bg-busy/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
