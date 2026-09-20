/**
 * VoiceGenderVerifyScreen — registration gender check via voice pitch (women only).
 * Men never see this screen. No photo/face gender verification.
 */
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useRegistrationGuard } from "@/hooks/useRegistrationGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ProgressIndicator from "@/components/ProgressIndicator";
import ScreenTitle from "@/components/ScreenTitle";
import { toast } from "@/hooks/use-toast";
import { analyseVoiceGenderFromBlob } from "@/lib/voice-gender";
import { ArrowLeft, Mic, Square, Loader2, Check } from "lucide-react";

const AuroraBackground = lazy(() => import("@/components/AuroraBackground"));

const RECORD_MS = 4000;

const VoiceGenderVerifyScreen = () => {
  const navigate = useNavigate();
  useRegistrationGuard([{ key: "userEmail" }, { key: "userGender" }], "/basic-info");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [passed, setPassed] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const gender = sessionStorage.getItem("userGender");
    // Men bypass voice gender verification entirely
    if (gender === "male") {
      navigate("/photo-upload", { replace: true });
    }
  }, [navigate]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopStream(), []);

  const finishWithResult = useCallback(
    async (blob: Blob) => {
      setAnalysing(true);
      try {
        const result = await analyseVoiceGenderFromBlob(blob);
        if (result.gender === "female") {
          sessionStorage.setItem("userGender", "female");
          sessionStorage.setItem("voiceGenderVerified", "true");
          setPassed(true);
          toast({
            title: "Voice verified",
            description: "Gender confirmed as female. Continue to your selfie.",
          });
        } else if (result.gender === "male") {
          sessionStorage.setItem("userGender", "male");
          sessionStorage.setItem("voiceGenderVerified", "true");
          toast({
            title: "Voice detected as male",
            description: "Your profile gender was set to male based on voice.",
          });
          navigate("/photo-upload");
        } else {
          toast({
            title: "Could not detect gender",
            description: "Please speak clearly for a few seconds and try again.",
            variant: "destructive",
          });
        }
      } catch (e) {
        console.error("[VoiceGender]", e);
        toast({
          title: "Voice check failed",
          description: "Microphone analysis failed. Please try again.",
          variant: "destructive",
        });
      } finally {
        setAnalysing(false);
      }
    },
    [navigate],
  );

  const startRecording = async () => {
    setPassed(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await finishWithResult(blob);
      };
      recorder.start();
      setRecording(true);
      setCountdown(Math.ceil(RECORD_MS / 1000));
      const tick = window.setInterval(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
      window.setTimeout(() => {
        window.clearInterval(tick);
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
        setRecording(false);
        setCountdown(0);
      }, RECORD_MS);
    } catch {
      toast({
        title: "Microphone blocked",
        description: "Allow microphone access to continue registration.",
        variant: "destructive",
      });
    }
  };

  const handleContinue = () => {
    if (!passed) {
      toast({
        title: "Voice verification required",
        description: "Record a short sample so we can confirm gender.",
        variant: "destructive",
      });
      return;
    }
    navigate("/photo-upload");
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-background text-foreground">
      <Suspense
        fallback={
          <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-secondary/30" />
        }
      >
        <AuroraBackground />
      </Suspense>

      <header className="px-6 pt-4 pb-2 relative z-10">
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/personal-details")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <ProgressIndicator currentStep={4} totalSteps={10} />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-6 relative z-10">
        <ScreenTitle
          title="Voice Gender Check"
          subtitle="Speak naturally for a few seconds — we confirm gender from your voice, not a photo"
          logoSize="sm"
          className="mb-6"
        />

        <Card className="w-full max-w-md p-6 space-y-4 border-primary/20 bg-card/80 backdrop-blur">
          <p className="text-sm text-muted-foreground text-center">
            Say a short sentence in a quiet place (for example: “Hello, I am joining Meow Meow”).
          </p>

          <div className="flex flex-col items-center gap-3 py-4">
            {recording ? (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
                  <Square className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-sm font-medium">Listening… {countdown}s</p>
              </>
            ) : analysing ? (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm">Analysing voice…</p>
              </>
            ) : passed ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-700">Female voice verified</p>
              </>
            ) : (
              <Button onClick={startRecording} className="gap-2" size="lg">
                <Mic className="w-5 h-5" />
                Start voice check
              </Button>
            )}
          </div>

          {!recording && !analysing && !passed && (
            <Button variant="outline" className="w-full" onClick={startRecording}>
              Try again
            </Button>
          )}

          <Button className="w-full" onClick={handleContinue} disabled={!passed || analysing || recording}>
            Continue
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default VoiceGenderVerifyScreen;
