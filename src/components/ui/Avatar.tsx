import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Avatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Cloudinary URLs, no next/image remote pattern configured yet
      <img
        src={photoUrl}
        alt={name}
        className={cn("h-12 w-12 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-muted text-sm font-semibold text-primary",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
