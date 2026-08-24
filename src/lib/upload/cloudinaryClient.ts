export async function uploadPhotoToCloudinary(file: File): Promise<string> {
  const sigResponse = await fetch("/api/uploads/cloudinary-signature", { method: "POST" });
  if (!sigResponse.ok) {
    throw new Error("Failed to prepare upload.");
  }
  const { signature, timestamp, folder, apiKey, cloudName } = await sigResponse.json();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: formData },
  );

  const body = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(body?.error?.message ?? "Upload failed.");
  }
  return body.secure_url as string;
}

export async function uploadCallRecordingToCloudinary(
  bookingId: string,
  blob: Blob,
): Promise<string> {
  const sigResponse = await fetch(`/api/bookings/${bookingId}/call/recording-signature`, {
    method: "POST",
  });
  if (!sigResponse.ok) {
    throw new Error("Failed to prepare recording upload.");
  }
  const { signature, timestamp, folder, resourceType, apiKey, cloudName } =
    await sigResponse.json();

  const formData = new FormData();
  formData.append("file", blob, `${bookingId}-${Date.now()}.webm`);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: formData },
  );

  const body = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(body?.error?.message ?? "Recording upload failed.");
  }
  return body.secure_url as string;
}
