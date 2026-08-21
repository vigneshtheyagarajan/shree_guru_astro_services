"use client";

import { useState } from "react";
import { uploadPhotoToCloudinary } from "@/lib/upload/cloudinaryClient";

export function PhotoUploadField({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPhotoToCloudinary(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Cloudinary URL, no remote pattern configured for next/image */}
          <img
            src={value}
            alt={label}
            className="h-16 w-16 rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-sm text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-background-elevated file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
      )}
      {uploading && <p className="text-xs text-foreground-muted">Uploading…</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
