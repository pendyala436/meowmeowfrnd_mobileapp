import { Toaster as Sonner, toast } from "sonner";
import { useAppTheme } from "@/contexts/ThemeContext";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedMode, themeId } = useAppTheme();

  return (
    <Sonner
      key={`${themeId}-${resolvedMode}`}
      theme="dark"
      className="toaster group !z-[300]"
      position="top-center"
      closeButton
      toastOptions={{
        duration: 5000,
        classNames: {
          toast:
            "group toast !text-white border shadow-lg !bg-[color-mix(in_srgb,hsl(var(--primary))_58%,#0b0b0b)] !border-white/25",
          title: "!text-white !font-semibold",
          description: "!text-white !opacity-95",
          success:
            "!bg-[color-mix(in_srgb,hsl(var(--success))_55%,#0b0b0b)] !text-white !border-white/20",
          error:
            "!bg-[color-mix(in_srgb,hsl(var(--destructive))_58%,#1a0505)] !text-white !border-white/25",
          warning:
            "!bg-[color-mix(in_srgb,hsl(var(--warning))_50%,#1a1200)] !text-white !border-white/20",
          info: "!bg-[color-mix(in_srgb,hsl(var(--info))_55%,#050a1a)] !text-white !border-white/20",
          actionButton: "!bg-white !text-[hsl(var(--primary))] !font-semibold",
          cancelButton: "!bg-white/20 !text-white",
          closeButton: "!bg-white/20 !text-white !border-white/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
