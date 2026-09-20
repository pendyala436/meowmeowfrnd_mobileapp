import { supabase } from "@/integrations/supabase/client";

/** Convert a data URL (from sessionStorage) into a JPEG Blob for storage upload. */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!dataUrl.startsWith("data:image")) return null;

  const base64Data = dataUrl.split(",")[1];
  if (!base64Data) return null;

  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteArray], { type: "image/jpeg" });
}

/** Upload a registration photo to profile-photos and return its public URL. */
export async function uploadRegistrationPhoto(
  userId: string,
  dataUrl: string,
  pathSuffix: string,
): Promise<string | null> {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;

  const fileName = `${userId}/${pathSuffix}_${Date.now()}.jpg`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

  if (uploadError || !uploadData) {
    console.error("[Registration] Photo upload failed:", uploadError?.message ?? "unknown error");
    return null;
  }

  const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(fileName);
  return urlData.publicUrl;
}
