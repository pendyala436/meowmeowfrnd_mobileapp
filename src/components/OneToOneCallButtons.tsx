import { Button } from "@/components/ui/button";
import { Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface OneToOneCallButtonsProps {
  onAudio: () => void;
  onVideo: () => void;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  size?: "sm" | "md";
}

export function OneToOneCallButtons({
  onAudio,
  onVideo,
  audioEnabled = true,
  videoEnabled = true,
  size = "sm",
}: OneToOneCallButtonsProps) {
  if (!audioEnabled && !videoEnabled) return null;

  const btnClass = cn(
    "rounded-full bg-primary p-0 text-white hover:bg-primary/90",
    size === "sm" ? "h-7 w-7" : "h-8 w-8",
  );
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <>
      {audioEnabled && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(btnClass, "hover:text-white")}
          onClick={onAudio}
          aria-label="Audio call"
        >
          <Phone className={iconClass} />
        </Button>
      )}
      {videoEnabled && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(btnClass, "hover:text-white")}
          onClick={onVideo}
          aria-label="Video call"
        >
          <Video className={iconClass} />
        </Button>
      )}
    </>
  );
}

export default OneToOneCallButtons;
