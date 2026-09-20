import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataUrlToBlob, uploadRegistrationPhoto } from "./registration-photos";

const upload = vi.fn();
const getPublicUrl = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload,
        getPublicUrl,
      }),
    },
  },
}));

const SAMPLE_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//2wBDAQ//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==";

describe("dataUrlToBlob", () => {
  it("returns null for non-image data URLs", () => {
    expect(dataUrlToBlob("data:text/plain,hello")).toBeNull();
    expect(dataUrlToBlob("")).toBeNull();
  });

  it("returns null when base64 payload is missing", () => {
    expect(dataUrlToBlob("data:image/jpeg;base64,")).toBeNull();
  });

  it("converts a JPEG data URL to a blob", () => {
    const blob = dataUrlToBlob(SAMPLE_JPEG);
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("image/jpeg");
    expect(blob?.size).toBeGreaterThan(0);
  });
});

describe("uploadRegistrationPhoto", () => {
  beforeEach(() => {
    upload.mockReset();
    getPublicUrl.mockReset();
  });

  it("returns null for invalid data URLs", async () => {
    await expect(uploadRegistrationPhoto("user-1", "not-an-image", "selfie")).resolves.toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns null when upload fails", async () => {
    upload.mockResolvedValue({ data: null, error: { message: "denied" } });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(uploadRegistrationPhoto("user-1", SAMPLE_JPEG, "selfie")).resolves.toBeNull();
    expect(err).toHaveBeenCalledWith("[Registration] Photo upload failed:", "denied");
    err.mockRestore();
  });

  it("returns null when upload returns no data and no error message", async () => {
    upload.mockResolvedValue({ data: null, error: null });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(uploadRegistrationPhoto("user-1", SAMPLE_JPEG, "selfie")).resolves.toBeNull();
    expect(err).toHaveBeenCalledWith("[Registration] Photo upload failed:", "unknown error");
    err.mockRestore();
  });

  it("returns the public URL after a successful upload", async () => {
    upload.mockResolvedValue({ data: { path: "user-1/selfie.jpg" }, error: null });
    getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://cdn.example/user-1/selfie.jpg" },
    });

    await expect(uploadRegistrationPhoto("user-1", SAMPLE_JPEG, "selfie")).resolves.toBe(
      "https://cdn.example/user-1/selfie.jpg",
    );
    expect(upload).toHaveBeenCalledOnce();
    expect(getPublicUrl).toHaveBeenCalledOnce();
  });
});
