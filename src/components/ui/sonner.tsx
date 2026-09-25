import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // Detect system theme preference
  const theme =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group !z-[300]"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        duration: 5000,
        classNames: {
          // App forces white text globally — toast surfaces must stay dark/colored.
          toast:
            "group toast !bg-[hsl(335_70%_28%)] !text-white border border-white/25 shadow-lg",
          title: "!text-white !font-semibold",
          description: "!text-white/90",
          success: "!bg-[hsl(88_40%_28%)] !text-white !border-white/20",
          error: "!bg-[hsl(0_72%_38%)] !text-white !border-white/25",
          warning: "!bg-[hsl(43_80%_32%)] !text-white !border-white/20",
          info: "!bg-[hsl(218_55%_32%)] !text-white !border-white/20",
          actionButton: "!bg-white !text-[hsl(335_70%_28%)]",
          cancelButton: "!bg-white/15 !text-white",
          closeButton: "!bg-white/15 !text-white !border-white/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
