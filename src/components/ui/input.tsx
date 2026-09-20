import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 min-h-[48px] w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-base text-white ring-offset-background transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:border-white/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-white/45 touch-manipulation appearance-none",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
