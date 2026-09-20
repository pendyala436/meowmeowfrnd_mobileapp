import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ERROR_MESSAGES, classifyError } from "@/lib/errors";
import { toast } from "sonner";
import { CheckCircle, Clock, XCircle, Loader2, AlertCircle, Camera, X, ImagePlus } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";

type KycPreviewKey =
  | "aadhaar_front"
  | "aadhaar_back"
  | "id_proof_front"
  | "id_proof_back"
  | "address_proof"
  | "selfie";

async function getSignedKycUrl(storedValue: string | null | undefined): Promise<string | null> {
  if (!storedValue) return null;
  try {
    let filePath = storedValue;
    const marker = "/kyc-documents/";
    const idx = storedValue.indexOf(marker);
    if (idx !== -1) filePath = storedValue.substring(idx + marker.length);
    // Already a full URL
    if (/^https?:\/\//i.test(filePath)) return filePath;
    const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

function KycFileUploadBox({
  label,
  file,
  savedPreviewUrl,
  existingUrl,
  onFileChange,
  onClearSavedPreview,
  jpegOnly = false,
  hint,
  isEditable,
}: {
  label: string;
  file: File | null;
  savedPreviewUrl?: string | null;
  existingUrl: string | null | undefined;
  onFileChange: (f: File | null) => void;
  onClearSavedPreview?: () => void;
  jpegOnly?: boolean;
  hint?: string;
  isEditable: boolean;
}) {
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewSrc = localPreview || savedPreviewUrl || null;
  const hasImage = Boolean(previewSrc);
  const isPdfOnly = !file && !!existingUrl && /\.pdf$/i.test(existingUrl) && !previewSrc;

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && jpegOnly) {
      const ok = f.type === "image/jpeg" || /\.jpe?g$/i.test(f.name);
      if (!ok) {
        toast.error("JPEG only", { description: "Please upload a .jpg / .jpeg file." });
        e.target.value = "";
        return;
      }
    }
    onFileChange(f);
    if (f) onClearSavedPreview?.();
    e.target.value = "";
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Label>{label}</Label>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        {isEditable && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={hasImage || existingUrl ? `Replace ${label}` : `Upload ${label}`}
              title={hasImage || existingUrl ? "Replace photo" : "Add photo"}
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={jpegOnly ? "image/jpeg,.jpg,.jpeg" : "image/*,.pdf"}
              onChange={onPick}
            />
          </>
        )}
      </div>

      <div className="mt-2">
        {hasImage && (
          <div className="relative inline-block max-w-full rounded-md border border-border bg-muted/20 p-1">
            <img
              src={previewSrc!}
              alt={label}
              className="max-h-52 w-auto max-w-full h-auto object-contain rounded-sm"
            />
            {isEditable && file && (
              <button
                type="button"
                className="absolute top-1.5 right-1.5 rounded-full bg-background/95 p-1 shadow border border-border"
                onClick={() => onFileChange(null)}
                aria-label={`Clear ${label}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {isPdfOnly && (
          <p className="text-xs text-muted-foreground">PDF on file — tap the photo icon to replace.</p>
        )}
        {!hasImage && !isPdfOnly && isEditable && (
          <p className="text-[11px] text-muted-foreground">Tap the photo icon to add.</p>
        )}
        {(file || (existingUrl && hasImage)) && (
          <p className="text-[11px] text-success mt-1">✓ {file ? "New file ready" : "Saved"}</p>
        )}
      </div>
    </div>
  );
}

const aadhaarRegex = /^\d{12}$/;

const kycSchema = z.object({
  // Section 1: Personal Information
  full_name_as_per_bank: z.string().min(2, "Full name is required").max(100),
  fathers_name: z.string().optional(),
  mothers_name: z.string().optional(),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().optional(),
  marital_status: z.string().optional(),
  nationality: z.string().default("Indian"),
  occupation: z.string().optional(),
  annual_income_range: z.string().optional(),

  // Section 2: Contact Information
  mobile_number: z.string().optional(),
  email_address: z.string().email("Invalid email").optional().or(z.literal("")),
  current_address: z.string().optional(),
  permanent_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pin_code: z.string().regex(/^\d{6}$/, "PIN code must be 6 digits").optional().or(z.literal("")),

  // Section 3: Identity Proof
  id_type: z.enum(["pan", "passport", "voter_id", "driving_license", "ration_card", "college_id", "government_id", "nrega_card", "defence_id", "postal_id"]),
  id_number: z.string().min(6, "Valid ID number required").max(20),

  // Section 4: Aadhaar (Address Proof)
  aadhaar_number: z.string().regex(aadhaarRegex, "Aadhaar must be 12 digits"),

  // Section 5: Address Proof
  address_proof_type: z.string().optional(),

  // Section 6: Bank Details
  country_of_residence: z.string().default("India"),
  bank_name: z.string().min(2, "Bank name is required").max(100),
  bank_branch_name: z.string().optional(),
  account_holder_name: z.string().min(2, "Account holder name is required").max(100),
  account_number: z.string().min(9, "Valid account number required").max(18),
  // Any Indian bank IFSC (4 letters + 0 + 6 alphanumeric) — not SBI-only.
  ifsc_code: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC (any Indian bank, e.g. HDFC0001234)")),
  account_type: z.string().default("savings"),
  upi_id: z.string().regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/, "Invalid UPI ID format (e.g. name@upi)").optional().or(z.literal("")),
  beneficiary_purpose: z.string().default("others"),

  // Section 7: Nominee Details
  nominee_name: z.string().optional(),
  nominee_relationship: z.string().optional(),
  nominee_dob: z.string().optional(),
  nominee_address: z.string().optional(),

  // Section 8: Declaration
  declaration_place: z.string().optional(),
  consent_given: z.boolean().refine(val => val === true, "You must provide consent"),
});

type KYCFormData = z.infer<typeof kycSchema>;

interface KYCRecord {
  id: string;
  user_id: string;
  full_name_as_per_bank: string;
  date_of_birth: string;
  gender: string | null;
  country_of_residence: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  id_type: string;
  id_number: string;
  aadhaar_number: string | null;
  aadhaar_front_url: string | null;
  aadhaar_back_url: string | null;
  id_proof_front_url: string | null;
  id_proof_back_url: string | null;
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
  verification_status: string;
  rejection_reason: string | null;
  consent_given: boolean;
  created_at: string;
  // New fields
  fathers_name: string | null;
  mothers_name: string | null;
  marital_status: string | null;
  nationality: string | null;
  occupation: string | null;
  annual_income_range: string | null;
  mobile_number: string | null;
  email_address: string | null;
  current_address: string | null;
  permanent_address: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  address_proof_type: string | null;
  address_proof_url: string | null;
  bank_branch_name: string | null;
  account_type: string | null;
  nominee_name: string | null;
  nominee_relationship: string | null;
  nominee_dob: string | null;
  nominee_address: string | null;
  declaration_place: string | null;
}

export function WomenKYCForm() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingKYC, setExistingKYC] = useState<KYCRecord | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingApproved, setEditingApproved] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [appSno, setAppSno] = useState<number | null>(null);

  // File uploads
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);
  const [idProofFront, setIdProofFront] = useState<File | null>(null);
  const [idProofBack, setIdProofBack] = useState<File | null>(null);
  const [addressProof, setAddressProof] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [savedPreviews, setSavedPreviews] = useState<Partial<Record<KycPreviewKey, string>>>({});
  const [showSelfieCamera, setShowSelfieCamera] = useState(false);
  const [selfieStream, setSelfieStream] = useState<MediaStream | null>(null);
  const [selfieLocalPreview, setSelfieLocalPreview] = useState<string | null>(null);
  const [saveBanner, setSaveBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const selfieVideoRef = useRef<HTMLVideoElement>(null);
  const selfieCanvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<KYCFormData>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      full_name_as_per_bank: "",
      fathers_name: "",
      mothers_name: "",
      date_of_birth: "",
      gender: "",
      marital_status: "",
      nationality: "Indian",
      occupation: "",
      annual_income_range: "",
      mobile_number: "",
      email_address: "",
      current_address: "",
      permanent_address: "",
      city: "",
      state: "",
      pin_code: "",
      country_of_residence: "India",
      bank_name: "",
      bank_branch_name: "",
      account_holder_name: "",
      account_number: "",
      ifsc_code: "",
      account_type: "savings",
      upi_id: "",
      beneficiary_purpose: "others",
      aadhaar_number: "",
      id_type: "pan",
      id_number: "",
      address_proof_type: "aadhaar",
      nominee_name: "",
      nominee_relationship: "",
      nominee_dob: "",
      nominee_address: "",
      declaration_place: "",
      consent_given: false,
    },
  });

  useEffect(() => {
    loadExistingKYC();
  }, []);

  useEffect(() => {
    if (selfieStream && selfieVideoRef.current && showSelfieCamera) {
      selfieVideoRef.current.srcObject = selfieStream;
    }
  }, [selfieStream, showSelfieCamera]);

  useEffect(() => {
    return () => {
      selfieStream?.getTracks().forEach((t) => t.stop());
    };
  }, [selfieStream]);

  useEffect(() => {
    if (!selfie) {
      setSelfieLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(selfie);
    setSelfieLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selfie]);

  const loadSavedPreviews = async (record: KYCRecord) => {
    const entries: [KycPreviewKey, string | null][] = [
      ["aadhaar_front", record.aadhaar_front_url],
      ["aadhaar_back", record.aadhaar_back_url],
      ["id_proof_front", record.id_proof_front_url],
      ["id_proof_back", record.id_proof_back_url],
      ["address_proof", record.address_proof_url],
      ["selfie", record.selfie_url],
    ];
    const resolved = await Promise.all(
      entries.map(async ([key, path]) => [key, await getSignedKycUrl(path)] as const)
    );
    const next: Partial<Record<KycPreviewKey, string>> = {};
    for (const [key, url] of resolved) {
      if (url) next[key] = url;
    }
    setSavedPreviews(next);
  };

  const stopSelfieCamera = useCallback(() => {
    selfieStream?.getTracks().forEach((t) => t.stop());
    setSelfieStream(null);
    setShowSelfieCamera(false);
  }, [selfieStream]);

  const startSelfieCamera = async () => {
    try {
      stopSelfieCamera();
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      setSelfieStream(media);
      setShowSelfieCamera(true);
    } catch {
      toast.error("Camera access needed", {
        description: "Allow the front camera to take your KYC selfie.",
      });
    }
  };

  const captureSelfiePhoto = () => {
    const video = selfieVideoRef.current;
    const canvas = selfieCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror for natural selfie look matching front camera
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `kyc-selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        setSelfie(file);
        stopSelfieCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  const loadExistingKYC = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);

      // Fetch App ID + SNO from profiles (single source of truth)
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('app_id, app_sno')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (profileRow) {
        setAppId((profileRow as any).app_id ?? null);
        setAppSno((profileRow as any).app_sno ?? null);
      }

      const { data, error } = await supabase
        .from('women_kyc')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        toast.error('Verification unavailable', { description: ERROR_MESSAGES.profile.kycLoadFailed });
        return;
      }

      if (data) {
        const record = data as unknown as KYCRecord;
        setExistingKYC(record);
        // Always restore last saved field values for edit / resubmit
        form.reset({
          full_name_as_per_bank: data.full_name_as_per_bank || "",
          fathers_name: (data as any).fathers_name || "",
          mothers_name: (data as any).mothers_name || "",
          date_of_birth: data.date_of_birth || "",
          gender: data.gender || "",
          marital_status: (data as any).marital_status || "",
          nationality: (data as any).nationality || "Indian",
          occupation: (data as any).occupation || "",
          annual_income_range: (data as any).annual_income_range || "",
          mobile_number: (data as any).mobile_number || "",
          email_address: (data as any).email_address || "",
          current_address: (data as any).current_address || "",
          permanent_address: (data as any).permanent_address || "",
          city: (data as any).city || "",
          state: (data as any).state || "",
          pin_code: (data as any).pin_code || "",
          country_of_residence: data.country_of_residence || "India",
          bank_name: data.bank_name || "",
          bank_branch_name: (data as any).bank_branch_name || "",
          account_holder_name: data.account_holder_name || "",
          account_number: data.account_number || "",
          ifsc_code: data.ifsc_code || "",
          account_type: (data as any).account_type || "savings",
          upi_id: (data as any).upi_id || (data as any).upi_vpa || "",
          beneficiary_purpose: (data as any).beneficiary_purpose || "others",
          aadhaar_number: (data as any).aadhaar_number || "",
          id_type: (data.id_type === 'aadhaar' ? 'pan' : data.id_type) as any,
          id_number: data.id_type === 'aadhaar' ? "" : (data.id_number || ""),
          address_proof_type: (data as any).address_proof_type || "aadhaar",
          nominee_name: (data as any).nominee_name || "",
          nominee_relationship: (data as any).nominee_relationship || "",
          nominee_dob: (data as any).nominee_dob || "",
          nominee_address: (data as any).nominee_address || "",
          declaration_place: (data as any).declaration_place || "",
          consent_given: data.consent_given ?? false,
        });
        await loadSavedPreviews(record);
      } else {
        setExistingKYC(null);
        setSavedPreviews({});
      }
    } catch (error) {
      toast.error("Could not load KYC", {
        description: classifyError(error, "load your verification details").message,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    if (!userId) throw new Error("Please log in to submit KYC");
    const fileExt = file.name.split('.').pop();
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const storagePath = `${userId}/${folder}/${Date.now()}-${randomSuffix}.${fileExt}`;
    const { error } = await supabase.storage.from('kyc-documents').upload(storagePath, file);
    if (error) {
      throw new Error(ERROR_MESSAGES.upload.failed);
    }
    // Store the path, not a public URL — use signed URLs for access
    return storagePath;
  };

  const onInvalid = () => {
    const message = "Please fix the highlighted fields, then try saving again.";
    setSaveBanner({ type: "error", message });
    toast.error("KYC form incomplete", { description: message, duration: 5000 });
  };

  const onSubmit = async (data: KYCFormData) => {
    if (!userId) {
      const message = "Please log in to submit KYC.";
      setSaveBanner({ type: "error", message });
      toast.error("Save failed", { description: message, duration: 5000 });
      return;
    }
    setSaveBanner(null);
    setSubmitting(true);
    setUploadingFiles(true);

    try {
      let aadhaarFrontUrl = existingKYC?.aadhaar_front_url || null;
      let aadhaarBackUrl = existingKYC?.aadhaar_back_url || null;
      let idProofFrontUrl = existingKYC?.id_proof_front_url || null;
      let idProofBackUrl = existingKYC?.id_proof_back_url || null;
      let addressProofUrl = existingKYC?.address_proof_url || null;
      let selfieUrl = existingKYC?.selfie_url || null;

      if (aadhaarFront) aadhaarFrontUrl = await uploadFile(aadhaarFront, 'aadhaar-front');
      if (aadhaarBack) aadhaarBackUrl = await uploadFile(aadhaarBack, 'aadhaar-back');
      if (idProofFront) idProofFrontUrl = await uploadFile(idProofFront, 'id-proof-front');
      if (idProofBack) idProofBackUrl = await uploadFile(idProofBack, 'id-proof-back');
      if (addressProof) addressProofUrl = await uploadFile(addressProof, 'address-proof');
      if (selfie) selfieUrl = await uploadFile(selfie, 'selfie');

      setUploadingFiles(false);

      const kycData: any = {
        user_id: userId,
        full_name_as_per_bank: data.full_name_as_per_bank.trim(),
        fathers_name: data.fathers_name?.trim() || null,
        mothers_name: data.mothers_name?.trim() || null,
        date_of_birth: data.date_of_birth,
        gender: data.gender || null,
        marital_status: data.marital_status || null,
        nationality: data.nationality || "Indian",
        occupation: data.occupation?.trim() || null,
        annual_income_range: data.annual_income_range || null,
        mobile_number: data.mobile_number?.trim() || null,
        email_address: data.email_address?.trim() || null,
        current_address: data.current_address?.trim() || null,
        permanent_address: data.permanent_address?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        pin_code: data.pin_code?.trim() || null,
        country_of_residence: data.country_of_residence,
        bank_name: data.bank_name.trim(),
        bank_branch_name: data.bank_branch_name?.trim() || null,
        account_holder_name: data.account_holder_name.trim(),
        account_number: data.account_number.trim(),
        ifsc_code: data.ifsc_code.toUpperCase().trim(),
        account_type: data.account_type || "savings",
        // DB column is upi_vpa only (upi_id is form-only and must not be sent)
        upi_vpa: data.upi_id?.trim() || null,
        beneficiary_purpose: data.beneficiary_purpose || "others",
        aadhaar_number: data.aadhaar_number.trim(),
        aadhaar_front_url: aadhaarFrontUrl,
        aadhaar_back_url: aadhaarBackUrl,
        id_type: data.id_type,
        id_number: data.id_number.trim(),
        id_proof_front_url: idProofFrontUrl,
        id_proof_back_url: idProofBackUrl,
        address_proof_type: data.address_proof_type || null,
        address_proof_url: addressProofUrl,
        document_front_url: aadhaarFrontUrl,
        document_back_url: aadhaarBackUrl,
        selfie_url: selfieUrl,
        nominee_name: data.nominee_name?.trim() || null,
        nominee_relationship: data.nominee_relationship?.trim() || null,
        nominee_dob: data.nominee_dob || null,
        nominee_address: data.nominee_address?.trim() || null,
        declaration_place: data.declaration_place?.trim() || null,
        consent_given: data.consent_given,
        consent_timestamp: new Date().toISOString(),
        verification_status: 'pending',
      };

      // Robust upsert (was a conditional update/insert that could silently
      // affect 0 rows yet still report success). .select() detects a
      // blocked / no-op write and surfaces an actionable message.
      const { data: saved, error } = await supabase
        .from('women_kyc')
        .upsert({ ...kycData, user_id: userId }, { onConflict: 'user_id' })
        .select('id');
      if (error) throw error;
      if (!saved || saved.length === 0) {
        throw new Error('Your session expired — please log out, log in again, and re-submit KYC.');
      }

      const wasUpdate = Boolean(existingKYC);
      const successMsg = wasUpdate
        ? "Your details were saved and are pending review."
        : "Your verification was saved successfully and is pending review.";
      setSaveBanner({ type: "success", message: successMsg });
      toast.success(wasUpdate ? "KYC updated" : "KYC submitted", {
        description: successMsg,
        duration: 5000,
      });

      setEditingApproved(false);
      setAadhaarFront(null);
      setAadhaarBack(null);
      setIdProofFront(null);
      setIdProofBack(null);
      setAddressProof(null);
      setSelfie(null);
      await loadExistingKYC();
      // Keep banner visible inside the sheet (toasts can sit under the sheet overlay)
      requestAnimationFrame(() => {
        document.querySelector("[data-kyc-form-top]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error: any) {
      const message = classifyError(error, "submit your verification documents").message;
      setSaveBanner({ type: "error", message });
      toast.error("KYC save failed", {
        description: message,
        duration: 6000,
      });
      requestAnimationFrame(() => {
        document.querySelector("[data-kyc-form-top]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } finally {
      setSubmitting(false);
      setUploadingFiles(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>;
      case 'pending': return <Badge className="bg-warning text-warning-foreground"><Clock className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getIdTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pan: 'PAN Card', passport: 'Passport', voter_id: 'Voter ID',
      driving_license: 'Driving Licence', ration_card: 'Ration Card',
      college_id: 'College ID', government_id: 'Government ID',
      nrega_card: 'NREGA Job Card', defence_id: 'Defence ID', postal_id: 'India Post ID',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></CardContent></Card>;
  }

  // Approved read-only view
  if (existingKYC?.verification_status === 'approved' && !editingApproved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">KYC Verification {getStatusBadge('approved')}</CardTitle>
          <CardDescription>Your KYC has been verified. You can receive payouts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(appId || appSno !== null) && (
            <div className="grid grid-cols-2 gap-4 text-sm p-3 rounded-lg bg-primary/5 border border-primary/20">
              {appId && <div><Label className="text-muted-foreground">App ID</Label><p className="font-mono font-semibold text-primary">{appId}</p></div>}
              {appSno !== null && <div><Label className="text-muted-foreground">Beneficiary ID / S.No</Label><p className="font-mono font-semibold text-primary">{appSno}</p></div>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><Label className="text-muted-foreground">Full Name</Label><p className="font-medium">{existingKYC.full_name_as_per_bank}</p></div>
            <div><Label className="text-muted-foreground">Bank</Label><p className="font-medium">{existingKYC.bank_name}</p></div>
            <div><Label className="text-muted-foreground">Account Number</Label><p className="font-medium">****{existingKYC.account_number.slice(-4)}</p></div>
            <div><Label className="text-muted-foreground">IFSC</Label><p className="font-medium">{existingKYC.ifsc_code}</p></div>
            <div><Label className="text-muted-foreground">Aadhaar</Label><p className="font-medium">****{(existingKYC.aadhaar_number || '').slice(-4)}</p></div>
            <div><Label className="text-muted-foreground">ID Proof</Label><p className="font-medium">{getIdTypeLabel(existingKYC.id_type)}: ****{existingKYC.id_number.slice(-4)}</p></div>
            <div><Label className="text-muted-foreground">Beneficiary Purpose</Label><p className="font-medium capitalize">{(existingKYC as any).beneficiary_purpose || 'others'}</p></div>
            {((existingKYC as any).upi_id || (existingKYC as any).upi_vpa) && <div><Label className="text-muted-foreground">UPI VPA</Label><p className="font-medium">{(existingKYC as any).upi_id || (existingKYC as any).upi_vpa}</p></div>}
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Editing will reset your KYC status to pending for re-verification.</p>
            <Button variant="outline" size="sm" onClick={() => setEditingApproved(true)}>Edit KYC Details</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEditable = !existingKYC || existingKYC.verification_status === 'pending' || existingKYC.verification_status === 'rejected' || editingApproved;

  return (
    <Card data-kyc-form-top>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Bank KYC Verification
          {existingKYC && getStatusBadge(existingKYC.verification_status)}
        </CardTitle>
        <CardDescription>Complete your KYC for bank payouts. All information is stored securely.</CardDescription>
        {existingKYC?.verification_status === 'rejected' && existingKYC.rejection_reason && (
          <div className="flex items-start gap-2 p-3 mt-2 bg-destructive/10 rounded-lg">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
              <p className="text-sm text-destructive/80">{existingKYC.rejection_reason}</p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {saveBanner && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
              saveBanner.type === "success"
                ? "border-success/40 bg-success/10 text-foreground"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
            role="status"
          >
            {saveBanner.type === "success" ? "✓ " : ""}
            {saveBanner.message}
          </div>
        )}
        {(appId || appSno !== null) && (
          <div className="grid grid-cols-2 gap-4 text-sm p-3 mb-6 rounded-lg bg-primary/5 border border-primary/20">
            {appId && <div><Label className="text-muted-foreground text-xs">App ID</Label><p className="font-mono font-semibold text-primary">{appId}</p></div>}
            {appSno !== null && <div><Label className="text-muted-foreground text-xs">Beneficiary ID / S.No</Label><p className="font-mono font-semibold text-primary">{appSno}</p></div>}
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">

            {/* Section 1: Personal Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">1. Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="full_name_as_per_bank" render={({ field }) => (
                  <FormItem><FormLabel>Full Name (as per bank) *</FormLabel><FormControl><Input {...field} placeholder="Enter full name" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="fathers_name" render={({ field }) => (
                  <FormItem><FormLabel>Father's / Mother's Name</FormLabel><FormControl><Input {...field} placeholder="Father's or Mother's name" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                  <FormItem><FormLabel>Date of Birth *</FormLabel><FormControl><Input {...field} type="date" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="marital_status" render={({ field }) => (
                  <FormItem><FormLabel>Marital Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="nationality" render={({ field }) => (
                  <FormItem><FormLabel>Nationality</FormLabel><FormControl><Input {...field} disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="occupation" render={({ field }) => (
                  <FormItem><FormLabel>Occupation</FormLabel><FormControl><Input {...field} placeholder="Your occupation" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="annual_income_range" render={({ field }) => (
                  <FormItem><FormLabel>Annual Income Range</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="below_1l">Below ₹1 Lakh</SelectItem>
                        <SelectItem value="1l_5l">₹1 - 5 Lakh</SelectItem>
                        <SelectItem value="5l_10l">₹5 - 10 Lakh</SelectItem>
                        <SelectItem value="10l_25l">₹10 - 25 Lakh</SelectItem>
                        <SelectItem value="above_25l">Above ₹25 Lakh</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Section 2: Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">2. Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="mobile_number" render={({ field }) => (
                  <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input {...field} placeholder="+91 XXXXX XXXXX" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email_address" render={({ field }) => (
                  <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} type="email" placeholder="email@example.com" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="current_address" render={({ field }) => (
                <FormItem><FormLabel>Current Address</FormLabel><FormControl><Textarea {...field} placeholder="Current residential address" disabled={!isEditable} rows={2} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="permanent_address" render={({ field }) => (
                <FormItem><FormLabel>Permanent Address</FormLabel><FormControl><Textarea {...field} placeholder="Permanent address (if different)" disabled={!isEditable} rows={2} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} placeholder="City" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} placeholder="State" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="pin_code" render={({ field }) => (
                  <FormItem><FormLabel>PIN Code</FormLabel><FormControl><Input {...field} placeholder="6-digit PIN" maxLength={6} disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Section 3: Identity Proof */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">3. Identity Proof</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="id_type" render={({ field }) => (
                  <FormItem><FormLabel>ID Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="pan">PAN Card</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="voter_id">Voter ID</SelectItem>
                        <SelectItem value="driving_license">Driving Licence</SelectItem>
                        <SelectItem value="ration_card">Ration Card</SelectItem>
                        <SelectItem value="college_id">College / University ID</SelectItem>
                        <SelectItem value="government_id">Government Employee ID</SelectItem>
                        <SelectItem value="nrega_card">NREGA Job Card</SelectItem>
                        <SelectItem value="defence_id">Defence / Ex-Servicemen ID</SelectItem>
                        <SelectItem value="postal_id">India Post ID Card</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="id_number" render={({ field }) => (
                  <FormItem><FormLabel>ID Number *</FormLabel><FormControl><Input {...field} placeholder="Enter ID number" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KycFileUploadBox
                  label="ID Proof Front (optional)"
                  file={idProofFront}
                  savedPreviewUrl={savedPreviews.id_proof_front}
                  existingUrl={existingKYC?.id_proof_front_url}
                  onFileChange={setIdProofFront}
                  onClearSavedPreview={() =>
                    setSavedPreviews((p) => {
                      const n = { ...p };
                      delete n.id_proof_front;
                      return n;
                    })
                  }
                  jpegOnly
                  hint="We accept JPEG format only."
                  isEditable={isEditable}
                />
                <KycFileUploadBox
                  label="ID Proof Back (optional)"
                  file={idProofBack}
                  savedPreviewUrl={savedPreviews.id_proof_back}
                  existingUrl={existingKYC?.id_proof_back_url}
                  onFileChange={setIdProofBack}
                  onClearSavedPreview={() =>
                    setSavedPreviews((p) => {
                      const n = { ...p };
                      delete n.id_proof_back;
                      return n;
                    })
                  }
                  isEditable={isEditable}
                />
              </div>
            </div>

            <Separator />

            {/* Section 4: Aadhaar Upload */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">4. Aadhaar Card (Address Proof)</h3>
              <p className="text-xs text-muted-foreground">Aadhaar number is required. Front/back photo uploads are optional (JPEG if uploaded).</p>
              <FormField control={form.control} name="aadhaar_number" render={({ field }) => (
                <FormItem><FormLabel>Aadhaar Number (12 digits) *</FormLabel><FormControl><Input {...field} placeholder="XXXX XXXX XXXX" maxLength={12} disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KycFileUploadBox
                  label="Aadhaar Front (optional)"
                  file={aadhaarFront}
                  savedPreviewUrl={savedPreviews.aadhaar_front}
                  existingUrl={existingKYC?.aadhaar_front_url}
                  onFileChange={setAadhaarFront}
                  onClearSavedPreview={() =>
                    setSavedPreviews((p) => {
                      const n = { ...p };
                      delete n.aadhaar_front;
                      return n;
                    })
                  }
                  jpegOnly
                  hint="We accept JPEG format only."
                  isEditable={isEditable}
                />
                <KycFileUploadBox
                  label="Aadhaar Back (optional)"
                  file={aadhaarBack}
                  savedPreviewUrl={savedPreviews.aadhaar_back}
                  existingUrl={existingKYC?.aadhaar_back_url}
                  onFileChange={setAadhaarBack}
                  onClearSavedPreview={() =>
                    setSavedPreviews((p) => {
                      const n = { ...p };
                      delete n.aadhaar_back;
                      return n;
                    })
                  }
                  isEditable={isEditable}
                />
              </div>
            </div>

            <Separator />

            {/* Section 5: Additional Address Proof */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">5. Additional Address Proof (Optional)</h3>
              <p className="text-xs text-muted-foreground">Optional. Upload only if you want extra address verification.</p>
              <FormField control={form.control} name="address_proof_type" render={({ field }) => (
                <FormItem><FormLabel>Address Proof Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="driving_license">Driving Licence</SelectItem>
                      <SelectItem value="electricity_bill">Electricity Bill</SelectItem>
                      <SelectItem value="gas_bill">Gas Bill</SelectItem>
                      <SelectItem value="water_bill">Water Bill</SelectItem>
                      <SelectItem value="bank_statement">Bank Statement</SelectItem>
                      <SelectItem value="rent_agreement">Rent Agreement</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <KycFileUploadBox
                label="Address Proof Document"
                file={addressProof}
                savedPreviewUrl={savedPreviews.address_proof}
                existingUrl={existingKYC?.address_proof_url}
                onFileChange={setAddressProof}
                onClearSavedPreview={() =>
                  setSavedPreviews((p) => {
                    const n = { ...p };
                    delete n.address_proof;
                    return n;
                  })
                }
                isEditable={isEditable}
              />
            </div>

            <Separator />

            {/* Section 6: Bank Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">6. Bank Details *</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="bank_name" render={({ field }) => (
                  <FormItem><FormLabel>Bank Name *</FormLabel><FormControl><Input {...field} placeholder="e.g. State Bank of India" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bank_branch_name" render={({ field }) => (
                  <FormItem><FormLabel>Branch Name</FormLabel><FormControl><Input {...field} placeholder="Branch name" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="account_holder_name" render={({ field }) => (
                  <FormItem><FormLabel>Account Holder Name *</FormLabel><FormControl><Input {...field} placeholder="Name as on bank account" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="account_number" render={({ field }) => (
                  <FormItem><FormLabel>Account Number *</FormLabel><FormControl><Input {...field} placeholder="Bank account number" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="ifsc_code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>IFSC Code *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Any bank, e.g. HDFC0001234"
                        className="uppercase"
                        disabled={!isEditable}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">Accepted for all Indian banks (not SBI-only).</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="account_type" render={({ field }) => (
                  <FormItem><FormLabel>Account Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="upi_id" render={({ field }) => (
                  <FormItem><FormLabel>UPI VPA</FormLabel><FormControl><Input {...field} placeholder="e.g. yourname@upi" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="beneficiary_purpose" render={({ field }) => (
                  <FormItem><FormLabel>Beneficiary Purpose *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="others">Others</SelectItem>
                        <SelectItem value="salary">Salary</SelectItem>
                        <SelectItem value="reimbursement">Reimbursement</SelectItem>
                        <SelectItem value="vendor_payment">Vendor Payment</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Section 7: Nominee Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">7. Nominee Details (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="nominee_name" render={({ field }) => (
                  <FormItem><FormLabel>Nominee Name</FormLabel><FormControl><Input {...field} placeholder="Nominee full name" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="nominee_relationship" render={({ field }) => (
                  <FormItem><FormLabel>Relationship</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="son">Son</SelectItem>
                        <SelectItem value="daughter">Daughter</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="nominee_dob" render={({ field }) => (
                  <FormItem><FormLabel>Nominee Date of Birth</FormLabel><FormControl><Input {...field} type="date" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="nominee_address" render={({ field }) => (
                <FormItem><FormLabel>Nominee Address</FormLabel><FormControl><Textarea {...field} placeholder="Nominee's address" disabled={!isEditable} rows={2} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <Separator />

            {/* Section 8: Selfie / Liveness */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">8. Selfie Verification *</h3>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Use the front camera for a clear face photo.
                </p>
                {isEditable && !showSelfieCamera && (
                  <button
                    type="button"
                    onClick={startSelfieCamera}
                    className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-primary hover:bg-muted transition-colors"
                    aria-label={
                      selfie || savedPreviews.selfie || existingKYC?.selfie_url
                        ? "Retake selfie"
                        : "Open front camera"
                    }
                    title={
                      selfie || savedPreviews.selfie || existingKYC?.selfie_url
                        ? "Retake selfie"
                        : "Open front camera"
                    }
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                )}
              </div>

              {(selfieLocalPreview || savedPreviews.selfie) && !showSelfieCamera && (
                <div className="relative inline-block max-w-full rounded-md border border-border bg-muted/20 p-1">
                  <img
                    src={selfieLocalPreview || savedPreviews.selfie!}
                    alt="KYC selfie preview"
                    className="max-h-64 w-auto max-w-full h-auto object-contain rounded-sm"
                  />
                  {isEditable && selfie && (
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 rounded-full bg-background/95 p-1 shadow border border-border"
                      onClick={() => setSelfie(null)}
                      aria-label="Clear selfie"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <p className="text-[11px] text-success mt-1 px-0.5">
                    ✓ {selfie ? "New selfie ready" : "Saved"}
                  </p>
                </div>
              )}

              {!selfieLocalPreview && !savedPreviews.selfie && !showSelfieCamera && isEditable && (
                <p className="text-[11px] text-muted-foreground">Tap the camera icon to take a selfie.</p>
              )}

              {showSelfieCamera && (
                <div className="space-y-3 max-w-sm">
                  <div className="relative rounded-xl overflow-hidden border border-primary/30 bg-black">
                    <video
                      ref={selfieVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-h-72 object-contain scale-x-[-1]"
                    />
                  </div>
                  <canvas ref={selfieCanvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={stopSelfieCamera}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" className="flex-1 gap-2" onClick={captureSelfiePhoto}>
                      <Camera className="w-4 h-4" />
                      Capture
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Section 9: Declaration */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">9. Declaration</h3>
              <FormField control={form.control} name="declaration_place" render={({ field }) => (
                <FormItem><FormLabel>Place</FormLabel><FormControl><Input {...field} placeholder="City/Town" disabled={!isEditable} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="consent_given" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 border-border">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!isEditable} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>I declare that the information provided is true and correct *</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      I hereby declare that the details furnished above are true and correct to the best of my knowledge and belief. I authorize Meow MEOW FRND APP to verify my identity and bank details for payout purposes.
                    </p>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {isEditable && (
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{uploadingFiles ? 'Uploading documents...' : 'Submitting...'}</>
                ) : (
                  existingKYC ? 'Update KYC' : 'Submit KYC'
                )}
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
