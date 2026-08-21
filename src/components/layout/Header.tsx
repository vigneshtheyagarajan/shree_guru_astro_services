import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { NotificationBell } from "@/components/layout/NotificationBell";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold text-primary">
          Shree Guru Astro Services
        </Link>
        {session?.user ? (
          <div className="flex items-center gap-3">
            <Link
              href="/astrologers"
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              Find an Astrologer
            </Link>
            {(session.user.role === "CLIENT" || session.user.role === "ASTROLOGER") && (
              <Link
                href="/bookings"
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                My Bookings
              </Link>
            )}
            {session.user.role === "ASTROLOGER" && (
              <>
                <Link
                  href="/astrologer/dashboard"
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link
                  href="/astrologer/services"
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
                  Services
                </Link>
                <Link
                  href="/astrologer/availability"
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
                  Availability
                </Link>
              </>
            )}
            {session.user.role === "ADMIN" && (
              <>
                <Link
                  href="/admin/astrologers"
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
                  Astrologers
                </Link>
                <Link
                  href="/admin/bookings"
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
                  Bookings
                </Link>
                <Link
                  href="/admin/payments"
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
                  Payments
                </Link>
                <Link
                  href="/admin/notifications"
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
                  Logs
                </Link>
              </>
            )}
            <NotificationBell />
            <span className="text-sm text-foreground-muted">
              {session.user.name}
            </span>
            <Badge variant="primary">{session.user.role}</Badge>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/astrologers"
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              Find an Astrologer
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
