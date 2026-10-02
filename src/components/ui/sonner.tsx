import { Toaster as Sonner, toast } from "sonner";
import { useAppTheme } from "@/contexts/ThemeContext";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedMode } = useAppTheme();

  return (
    <Sonner
      theme={resolvedMode}
      className="toaster group !z-[300]"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        duration: 5000,
        classNames: {
          // Surfaces come from theme CSS vars in index.css; keep text white for global contrast rules.
          toast: "group toast border shadow-lg",
          title: "!text-white !font-semibold",
          description: "!text-white/90",
          actionButton:
            "!bg-[hsl(var(--primary-foreground))] !text-[hsl(var(--primary))]",
          cancelButton: "!bg-white/15 !text-white",
          closeButton: "!bg-white/15 !text-white !border-white/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
