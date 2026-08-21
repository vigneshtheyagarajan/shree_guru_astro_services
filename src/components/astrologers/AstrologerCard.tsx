import Link from "next/link";
import { Avatar, Badge, Card, CardContent } from "@/components/ui";

export interface AstrologerCardData {
  id: string;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  languages: string[];
  experienceYears: number | null;
  ratingAvg: number;
  ratingCount: number;
  categories: string[];
  startingPrice: number | null;
}

export function AstrologerCard({ astrologer }: { astrologer: AstrologerCardData }) {
  return (
    <Link href={`/astrologers/${astrologer.id}`}>
      <Card className="flex h-full flex-col transition-colors hover:border-primary">
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <Avatar name={astrologer.name} photoUrl={astrologer.photoUrl} />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background-surface bg-foreground-muted"
                aria-label="Offline"
                title="Offline"
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-foreground">{astrologer.name}</h3>
              <p className="truncate text-sm text-foreground-muted">
                {astrologer.languages.join(", ") || "Languages not listed"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {astrologer.categories.map((category) => (
              <Badge key={category} variant="default">
                {category}
              </Badge>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-foreground-muted">
              <span aria-hidden>★</span>
              <span>
                {astrologer.ratingCount > 0
                  ? `${astrologer.ratingAvg.toFixed(1)} (${astrologer.ratingCount})`
                  : "New"}
              </span>
              {astrologer.experienceYears != null && (
                <span className="text-foreground-muted">
                  · {astrologer.experienceYears} yrs
                </span>
              )}
            </div>
            <span className="font-medium text-foreground">
              {astrologer.startingPrice != null
                ? `From ₹${astrologer.startingPrice}`
                : "Pricing unavailable"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
