import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useFaceVerification, GENDER_SUCCESS_MIN } from "@/hooks/useFaceVerification";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Check, X, Loader2, Sparkles, ScanFace, Sun, ImageIcon } from "lucide-react";
import MeowLogo from "@/components/MeowLogo";
import {
  markGenderVerified,
  clearRoleCache,
  LOGIN_GENDER_VERIFY_ENABLED,
} from "@/components/ProtectedRoute";

const AuroraBackground = lazy(() => import("@/components/AuroraBackground"));

/** Accept from 50% — female scores are calibrated to 80–100% on success. */
const MIN_CONFIDENCE = GENDER_SUCCESS_MIN;

type VerificationState = "idle" | "verifying" | "verified" | "failed";

const GenderVerifyScreen = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { verifyFace, isLoadingModel } = useFaceVerification();

  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<VerificationState>("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [detected, setDetected] = useState<"male" | "female" | "unknown" | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [declared, setDeclared] = useState<"male" | "female" | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!LOGIN_GENDER_VERIFY_ENABLED) {
      navigate("/captcha", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) {
        navigate("/", { replace: true });
        return;
      }
      if (cancelled) return;
      setUserId(uid);

      const { data: adminRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      if (adminRow) {
        navigate("/captcha", { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("gender")
        .eq("user_id", uid)
        .maybeSingle();
      const g = profile?.gender?.toLowerCase();
      if (g === "male" || g === "female") setDeclared(g);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (stream && videoRef.current && showCamera) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, showCamera]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      setStream(media);
      setShowCamera(true);
    } catch {
      toast({
        title: "Camera access needed",
        description: "Allow the camera so we can verify your gender from a live photo.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result as string);
          setState("idle");
          setDetected(null);
          setReason(null);
          stopCamera();
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.9,
    );
  };

  const runVerify = async () => {
    if (!preview) return;
    setState("verifying");
    setReason(null);
    const result = await verifyFace(preview, declared || undefined);
    if (!result.hasFace || !result.verified || result.modelLoadFailed) {
      setState("failed");
      setReason(result.reason || "No face found. Take a clearer photo and try again.");
      return;
    }
    if (result.detectedGender !== "male" && result.detectedGender !== "female") {
      setState("failed");
      setReason(
        "Could not read gender from this photo. Try again with more light, facing the camera.",
      );
      return;
    }
    if (declared === "female" && result.detectedGender === "male") {
      setState("failed");
      setDetected(result.detectedGender);
      setConfidence(result.confidence);
      setReason(
        "Photo read as male — please retake with good lighting, facing the camera. Your Women dashboard is unchanged.",
      );
      return;
    }
    if (result.confidence < MIN_CONFIDENCE) {
      setState("failed");
      setDetected(result.detectedGender);
      setConfidence(result.confidence);
      setReason(
        `Low confidence (${Math.round(result.confidence * 100)}%). Retake the photo — we will not change your dashboard on a weak match.`,
      );
      return;
    }
    setDetected(result.detectedGender);
    setConfidence(result.confidence);
    setState("verified");
    setReason(result.reason);
  };

  const continueAfterVerify = async () => {
    if (
      !userId ||
      !detected ||
      (detected !== "male" && detected !== "female") ||
      state !== "verified"
    )
      return;
    setSaving(true);
    try {
      if (declared !== detected) {
        const { error } = await supabase
          .from("profiles")
          .update({ gender: detected })
          .eq("user_id", userId);
        if (error) throw error;
        sessionStorage.setItem("userGender", detected);
        const dest = detected === "female" ? "/women-dashboard" : "/dashboard";
        sessionStorage.setItem("postCaptchaRedirect", dest);
        toast({
          title: "Gender updated from photo",
          description: `Detected ${detected}. You will open the ${detected === "female" ? "Women" : "Men"}'s dashboard.`,
        });
      } else if (!sessionStorage.getItem("postCaptchaRedirect")) {
        sessionStorage.setItem(
          "postCaptchaRedirect",
          detected === "female" ? "/women-dashboard" : "/dashboard",
        );
      }
      markGenderVerified(userId);
      clearRoleCache();
      navigate("/captcha", { replace: true });
    } catch (err: any) {
      toast({
        title: "Could not save gender",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-background text-foreground w-full max-w-full overflow-x-hidden">
      <Suspense
        fallback={
          <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-secondary/30" />
        }
      >
        <AuroraBackground />
      </Suspense>

      <header
        data-app-header
        className="px-4 pt-3 pb-2 sm:px-6 sm:pt-6 sm:pb-3 relative z-10 shrink-0"
      >
        <div className="text-center">
          <MeowLogo size="sm" className="mx-auto mb-1 sm:mb-2 sm:hidden" />
          <MeowLogo size="md" className="mx-auto mb-2 hidden sm:block" />
          <h1 className="font-display text-xl sm:text-3xl font-bold text-primary mb-0.5">
            Gender check
          </h1>
          <p className="text-primary/80 text-xs sm:text-sm">
            A live photo decides Men or Women dashboard
          </p>
        </div>
      </header>

      <main
        data-app-body
        className="flex-1 flex flex-col items-center px-4 pb-6 relative z-10 w-full min-h-0 overflow-y-auto overscroll-contain"
      >
        {showCamera && (
          <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-4 overflow-y-auto">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-[45vh] rounded-2xl border-2 border-primary/20"
            />
            <ul className="mt-3 space-y-1.5 text-sm text-white/90 max-w-sm w-full list-none">
              <li className="flex items-start gap-2">
                <Sun className="h-4 w-4 shrink-0 mt-0.5 text-white" />
                <span>Use bright, even light on your face — avoid shadows and backlight.</span>
              </li>
              <li className="flex items-start gap-2">
                <ImageIcon className="h-4 w-4 shrink-0 mt-0.5 text-white" />
                <span>Stand in front of a plain, uncluttered background.</span>
              </li>
              <li className="flex items-start gap-2">
                <ScanFace className="h-4 w-4 shrink-0 mt-0.5 text-white" />
                <span>Look straight at the camera with your face clearly visible.</span>
              </li>
            </ul>
            <div className="flex gap-4 mt-4 shrink-0">
              <Button variant="outline" onClick={stopCamera}>
                Cancel
              </Button>
              <Button onClick={capturePhoto} className="gap-2">
                <Camera className="h-4 w-4" />
                Take photo
              </Button>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />

        <Card className="w-full max-w-md p-4 sm:p-5 bg-card/90 backdrop-blur-xl border border-primary/20 shadow-lg mb-4">
          <div className="text-center mb-3">
            <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 mb-2">
              <ScanFace className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              {declared
                ? `Profile says ${declared}. The photo result wins if it is confident.`
                : "Take a selfie so we can route you to the right dashboard."}
            </p>
            {isLoadingModel && (
              <p className="text-xs text-muted-foreground mt-1">Loading face model…</p>
            )}
          </div>

          {/* Tips only before capture — keeps Retake / Verify visible after photo */}
          {!preview && (
            <div className="mb-4 rounded-xl border border-white/25 bg-white/10 p-3 space-y-2 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-white">Photo tips</p>
              <ul className="space-y-1.5 text-xs text-white/85">
                <li className="flex items-start gap-2">
                  <Sun className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium text-white">Lighting:</span> Face a window or lamp
                    so light is even on both sides of your face. Avoid dark rooms and strong
                    backlight.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium text-white">Background:</span> Use a plain wall or
                    simple background — no busy patterns, posters, or other people behind you.
                  </span>
                </li>
              </ul>
            </div>
          )}

          {!preview ? (
            <Button
              variant="outline"
              className="w-full h-28 sm:h-32 border-dashed border-2 flex-col gap-2"
              onClick={startCamera}
            >
              <Camera className="h-8 w-8 text-primary" />
              <span>Open camera</span>
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden mx-auto w-40 h-40 sm:w-44 sm:h-44 bg-muted">
                <img
                  src={preview}
                  alt="Gender verification selfie"
                  className="w-full h-full object-cover"
                />
                {state === "verifying" && (
                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <p className="text-xs">Reading gender…</p>
                  </div>
                )}
                {state === "verified" && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1.5">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                {state === "failed" && (
                  <div className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1.5">
                    <X className="h-4 w-4" />
                  </div>
                )}
              </div>
              {detected && (
                <p className="text-center text-sm">
                  Detected <span className="font-semibold capitalize">{detected}</span>
                  {confidence > 0 ? ` · ${Math.round(confidence * 100)}%` : ""}
                </p>
              )}
              {reason && <p className="text-xs text-center text-muted-foreground">{reason}</p>}
              <div className="sticky bottom-0 z-10 flex gap-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] bg-card/95 backdrop-blur-sm">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setPreview(null);
                    setState("idle");
                    setDetected(null);
                    setReason(null);
                  }}
                >
                  Retake
                </Button>
                {state !== "verified" ? (
                  <Button
                    className="flex-1"
                    onClick={() => void runVerify()}
                    disabled={state === "verifying" || isLoadingModel}
                  >
                    {state === "verifying" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Verify photo"
                    )}
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    onClick={() => void continueAfterVerify()}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default GenderVerifyScreen;
