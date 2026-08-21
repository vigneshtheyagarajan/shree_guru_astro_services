import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { MobileNav, type NavLink } from "@/components/layout/MobileNav";

export async function Header() {
  const session = await auth();
  const role = session?.user.role;

  const links: NavLink[] = [{ href: "/astrologers", label: "Find an Astrologer" }];
  if (role === "CLIENT" || role === "ASTROLOGER") {
    links.push({ href: "/bookings", label: "My Bookings" });
  }
  if (role === "ASTROLOGER") {
    links.push(
      { href: "/astrologer/dashboard", label: "Dashboard" },
      { href: "/astrologer/services", label: "Services" },
      { href: "/astrologer/availability", label: "Availability" },
    );
  }
  if (role === "ADMIN") {
    links.push(
      { href: "/admin/astrologers", label: "Astrologers" },
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/notifications", label: "Logs" },
    );
  }

  return (
    <header className="relative border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0 text-sm font-semibold text-primary">
          Shree Guru Astro Services
        </Link>

        {session?.user ? (
          <>
            <div className="hidden items-center gap-3 md:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              <NotificationBell />
              <span className="text-sm text-foreground-muted">{session.user.name}</span>
              <Badge variant="primary">{session.user.role}</Badge>
              <SignOutButton />
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <NotificationBell />
              <MobileNav links={links} userName={session.user.name} userRole={session.user.role} />
            </div>
          </>
        ) : (
          <>
            <div className="hidden items-center gap-3 md:flex">
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
            <div className="flex items-center gap-2 md:hidden">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign up</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
