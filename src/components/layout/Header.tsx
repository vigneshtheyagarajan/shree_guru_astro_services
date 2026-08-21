import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { MobileNav, type NavLink } from "@/components/layout/MobileNav";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { getLocale, translate } from "@/lib/i18n/getLocale";

export async function Header() {
  const session = await auth();
  const role = session?.user.role;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  const links: NavLink[] = [{ href: "/astrologers", label: t("nav.findAstrologer") }];
  if (role === "CLIENT" || role === "ASTROLOGER") {
    links.push({ href: "/bookings", label: "My Bookings" });
  }
  if (role === "ASTROLOGER") {
    links.push(
      { href: "/astrologer/dashboard", label: "Dashboard" },
      { href: "/astrologer/services", label: "Services" },
      { href: "/astrologer/availability", label: "Availability" },
      { href: "/astrologer/payouts", label: "Payouts" },
    );
  }
  if (role === "ADMIN") {
    links.push(
      { href: "/admin/astrologers", label: "Astrologers" },
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/payouts", label: "Payouts" },
      { href: "/admin/disputes", label: "Disputes" },
      { href: "/admin/moderation", label: "Moderation" },
      { href: "/admin/notifications", label: "Logs" },
    );
  }
  if (role) {
    links.push({ href: "/settings", label: "Settings" });
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
              <LanguageSwitcher />
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
                {t("nav.findAstrologer")}
              </Link>
              <LanguageSwitcher />
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">{t("nav.signup")}</Button>
              </Link>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <LanguageSwitcher />
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">{t("nav.signup")}</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
