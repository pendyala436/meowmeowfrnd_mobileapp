import { useEffect, useRef } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface IncomingCallBannerProps {
  callerName: string;
  callerPhoto: string | null;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallBanner = ({
  callerName, callerPhoto, callType, onAccept, onDecline,
}: IncomingCallBannerProps) => {
  const ringRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const playRing = () => {
    try {
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;
      const t = ctx.currentTime;

      [0, 0.45].forEach(offset => {
        const osc1 = ctx.createOscillator();
        const g1 = ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(2000, t + offset);
        g1.gain.setValueAtTime(0.8, t + offset);
        g1.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.35);
        osc1.connect(g1).connect(ctx.destination);
        osc1.start(t + offset);
        osc1.stop(t + offset + 0.35);

        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(2500, t + offset);
        g2.gain.setValueAtTime(0.6, t + offset);
        g2.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.3);
        osc2.connect(g2).connect(ctx.destination);
        osc2.start(t + offset);
        osc2.stop(t + offset + 0.3);

        const osc3 = ctx.createOscillator();
        const g3 = ctx.createGain();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(440, t + offset);
        g3.gain.setValueAtTime(0.5, t + offset);
        g3.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.3);
        osc3.connect(g3).connect(ctx.destination);
        osc3.start(t + offset);
        osc3.stop(t + offset + 0.3);
      });
    } catch {}
  };

  useEffect(() => {
    playRing();
    ringRef.current = setInterval(playRing, 2000);
    return () => {
      if (ringRef.current) clearInterval(ringRef.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-primary via-background to-primary/80 flex flex-col items-center justify-between py-20 text-foreground">
      <div className="flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm uppercase tracking-wider">
          Incoming {callType} call
        </p>
        <Avatar className="h-28 w-28 border-4 border-primary/30 shadow-2xl">
          <AvatarImage src={callerPhoto || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
            {callerName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-foreground text-3xl font-semibold">{callerName}</h2>
      </div>

      <div className="flex justify-around w-full max-w-xs">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onDecline}
            className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform animate-pulse"
          >
            <PhoneOff className="w-7 h-7 text-destructive-foreground" />
          </button>
          <span className="text-muted-foreground text-xs">Decline</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-success flex items-center justify-center shadow-lg active:scale-95 transition-transform animate-pulse"
          >
            <Phone className="w-7 h-7 text-success-foreground" />
          </button>
          <span className="text-muted-foreground text-xs">Accept</span>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallBanner;
