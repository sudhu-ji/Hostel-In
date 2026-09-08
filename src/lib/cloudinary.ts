/**
 * Uploads a file (image or raw document like PDF) to Cloudinary
 * using direct unsigned client-side uploads.
 */
export async function uploadToCloudinary(file: File): Promise<{ url: string; publicId: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary client configuration missing (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const resourceType = file.type.startsWith("image/") ? "image" : "raw";

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    let errMsg = "Failed to upload to Cloudinary";
    try {
      const errData = await res.json();
      errMsg = errData.error?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id
  };
}

/**
 * Triggers a secure serverless deletion request for a Cloudinary asset
 */
export async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'raw'): Promise<boolean> {
  if (!publicId) return false;
  try {
    const res = await fetch("/api/storage/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ publicId, resourceType })
    });
    return res.ok;
  } catch (e) {
    console.error("Cloudinary deletion API error:", e);
    return false;
  }
}

/**
 * Returns a Cloudinary URL modified to force browser download as attachment
 */
export function getCloudinaryDownloadUrl(url: string): string {
  if (!url) return url;
  if (url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/fl_attachment/");
  }
  return url;
}
