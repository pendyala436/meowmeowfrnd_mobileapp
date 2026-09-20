import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold text-white ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-white active:scale-[0.98] touch-manipulation select-none cursor-pointer shadow-sm",
  {
    variants: {
      variant: {
        // Primary - fully solid with strong visibility
        default: "bg-primary text-white hover:bg-primary/90 active:bg-primary/80 shadow-md hover:shadow-lg border border-primary",
        
        // Destructive - red solid button
        destructive: "bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80 shadow-md border border-destructive",
        
        // Outline - visible border with background tint
        outline: "border-2 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white active:bg-white/25 shadow-sm",
        
        // Secondary - subtle but visible
        secondary: "bg-white/15 text-white hover:bg-white/25 active:bg-white/30 border border-white/30 shadow-sm",
        
        // Ghost - subtle with visible hover
        ghost: "text-white hover:bg-white/15 active:bg-white/25 border border-transparent hover:border-white/30",
        
        // Link - text only
        link: "text-white underline-offset-4 hover:underline hover:text-white shadow-none",
        
        // Gradient buttons - always visible
        gradient: "gradient-primary text-white hover:opacity-90 active:opacity-80 shadow-md border border-primary/20",
        hero: "gradient-primary text-white font-display font-bold text-base hover:opacity-90 active:opacity-80 shadow-lg border border-primary/20",
        
        // Semantic status variants
        success: "bg-success text-white hover:bg-success/90 active:bg-success/80 shadow-md border border-success",
        successOutline: "border-2 border-success bg-white/10 text-white hover:bg-success hover:text-white shadow-sm",
        warning: "bg-warning text-white hover:bg-warning/90 active:bg-warning/80 shadow-md border border-warning",
        info: "bg-info text-white hover:bg-info/90 active:bg-info/80 shadow-md border border-info",
        
        // Aurora themed variants - fully visible
        aurora: "gradient-aurora text-white aurora-glow hover:opacity-95 active:opacity-85 shadow-lg border border-primary/20",
        auroraOutline: "border-2 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white active:bg-white/25 shadow-sm",
        auroraGhost: "bg-white/15 text-white hover:bg-white/25 active:bg-white/35 border border-white/30 shadow-sm",
        auroraSoft: "bg-white/20 text-white border-2 border-white/35 hover:bg-white/30 active:bg-white/40 shadow-sm",
        auroraHero: "gradient-aurora text-white aurora-glow font-display font-bold hover:opacity-95 active:opacity-85 shadow-xl border border-primary/20",
      },
      size: {
        default: "h-11 px-6 py-2 min-h-[44px]",
        sm: "h-10 rounded-lg px-4 min-h-[40px]",
        lg: "h-14 rounded-2xl px-10 text-base min-h-[56px]",
        xl: "h-16 rounded-2xl px-12 text-lg min-h-[64px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
