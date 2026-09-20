import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { useRegistrationGuard } from "@/hooks/useRegistrationGuard";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ProgressIndicator from "@/components/ProgressIndicator";
import ScreenTitle from "@/components/ScreenTitle";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, Check, X } from "lucide-react";

const AuroraBackground = lazy(() => import("@/components/AuroraBackground"));

/** Registration selfie only — camera capture, no photo upload / gender check. */
const PhotoUploadScreen = () => {
  const navigate = useNavigate();
  useRegistrationGuard([{ key: "userEmail" }, { key: "userGender" }], "/basic-info");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    const existing = sessionStorage.getItem("pendingPhotoData");
    if (existing) setSelfiePreview(existing);
  }, []);

  const handleSelfieCapture = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid capture",
        description: "Please take a photo with the camera.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please retake a smaller photo.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setSelfiePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setShowCamera(false);
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setStream(mediaStream);
      setShowCamera(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      toast({
        title: "Camera unavailable",
        description: "Please allow camera access to take your selfie.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => () => {
    stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        handleSelfieCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  };

  const compressImage = (dataUrl: string, quality = 0.85): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1080;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const handleNext = async () => {
    if (!selfiePreview) {
      toast({
        title: "Selfie required",
        description: "Please take a selfie before continuing",
        variant: "destructive",
      });
      return;
    }
    try {
      const compressed = await compressImage(selfiePreview);
      sessionStorage.setItem("pendingPhotoData", compressed);
    } catch {
      toast({
        title: "Storage Error",
        description: "Unable to save the selfie. Your device storage may be full.",
        variant: "destructive",
      });
      return;
    }
    navigate("/additional-photos");
  };

  const handleBack = () => {
    stopCamera();
    const gender = sessionStorage.getItem("userGender");
    navigate(gender === "female" ? "/voice-gender-verify" : "/personal-details");
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
            onClick={handleBack}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <ProgressIndicator currentStep={5} totalSteps={10} />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center px-4 pb-6 relative z-10">
        <ScreenTitle
          title="Take a Selfie"
          subtitle="Use your camera for a clear profile photo — gender is not checked from photos"
          logoSize="sm"
          className="mb-3 shrink-0"
        />

        {showCamera && (
          <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom,24px))]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-md max-h-[55dvh] object-cover rounded-2xl"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={stopCamera}>
                Cancel
              </Button>
              <Button onClick={capturePhoto}>Capture</Button>
            </div>
          </div>
        )}

        <Card className="w-full max-w-md p-4 space-y-4 border-primary/20 bg-card/80 backdrop-blur">
          {selfiePreview ? (
            <div className="relative">
              <img
                src={selfiePreview}
                alt="Selfie preview"
                className="w-full max-h-[36dvh] object-cover rounded-xl cursor-pointer"
                onClick={() => setLightboxSrc(selfiePreview)}
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => setSelfiePreview(null)}
              >
                <X className="w-4 h-4" />
              </Button>
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <Check className="w-4 h-4" /> Photo ready
              </div>
            </div>
          ) : (
            <Button onClick={startCamera} className="w-full gap-2">
              <Camera className="w-4 h-4" /> Open camera
            </Button>
          )}
        </Card>
      </main>

      <footer className="relative z-10 shrink-0 px-4 pt-2 bg-background/95 backdrop-blur border-t border-border/40 pb-[max(1.25rem,env(safe-area-inset-bottom,28px))]">
        <div className="mx-auto w-full max-w-md">
          <Button className="w-full" onClick={handleNext} disabled={!selfiePreview}>
            Continue
          </Button>
        </div>
      </footer>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="Full selfie" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default PhotoUploadScreen;
