"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { SignOutButton } from "@/components/layout/SignOutButton";

export interface NavLink {
  href: string;
  label: string;
}

export function MobileNav({
  links,
  userName,
  userRole,
}: {
  links: NavLink[];
  userName?: string | null;
  userRole?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Toggle menu"
        aria-expanded={open}
        className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-lg border border-border"
      >
        <span className="h-0.5 w-4 bg-foreground" />
        <span className="h-0.5 w-4 bg-foreground" />
        <span className="h-0.5 w-4 bg-foreground" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 flex flex-col gap-1 border-b border-border bg-background-surface p-4">
          {userName && (
            <div className="mb-2 flex items-center gap-2 border-b border-border pb-3">
              <span className="text-sm text-foreground">{userName}</span>
              {userRole && <Badge variant="primary">{userRole}</Badge>}
            </div>
          )}
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-sm text-foreground-muted hover:bg-background-elevated hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {userName && (
            <div className="mt-2 border-t border-border pt-3">
              <SignOutButton />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
