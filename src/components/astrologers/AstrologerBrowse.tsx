"use client";

import { useMemo, useState } from "react";
import { AstrologerCard, type AstrologerCardData } from "@/components/astrologers/AstrologerCard";
import { Checkbox, Input, Select } from "@/components/ui";

export function AstrologerBrowse({
  astrologers,
  categories,
  languages,
  initialCategory = "",
}: {
  astrologers: AstrologerCardData[];
  categories: string[];
  languages: string[];
  initialCategory?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [language, setLanguage] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const filtered = useMemo(() => {
    return astrologers.filter((astrologer) => {
      if (category && !astrologer.categories.includes(category)) return false;
      if (language && !astrologer.languages.includes(language)) return false;
      if (minPrice && (astrologer.startingPrice ?? Infinity) < Number(minPrice)) return false;
      if (maxPrice && (astrologer.startingPrice ?? -Infinity) > Number(maxPrice)) return false;
      return true;
    });
  }, [astrologers, category, language, minPrice, maxPrice]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-background-surface p-4">
        <Select
          label="Category"
          placeholder="All categories"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          options={categories.map((c) => ({ label: c, value: c }))}
          className="w-48"
        />
        <Select
          label="Language"
          placeholder="All languages"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          options={languages.map((l) => ({ label: l, value: l }))}
          className="w-40"
        />
        <Input
          label="Min price (₹)"
          type="number"
          min={0}
          value={minPrice}
          onChange={(event) => setMinPrice(event.target.value)}
          className="w-32"
        />
        <Input
          label="Max price (₹)"
          type="number"
          min={0}
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          className="w-32"
        />
        <div title="Live online status is coming soon">
          <Checkbox label="Online now" disabled />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          No astrologers match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((astrologer) => (
            <AstrologerCard key={astrologer.id} astrologer={astrologer} />
          ))}
        </div>
      )}
    </div>
  );
}
