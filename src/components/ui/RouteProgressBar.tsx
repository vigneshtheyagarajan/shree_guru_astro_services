"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Safety net for navigations that only change the query string (e.g. admin
// filters) -- pathname won't change, so nothing would otherwise clear the
// bar. useSearchParams would also catch that, but requires wrapping this
// component in <Suspense>; a max-duration timeout is simpler for a purely
// cosmetic indicator.
const MAX_VISIBLE_MS = 4000;

/**
 * Site-wide top progress bar for navigation clicks. Listens for clicks on
 * same-origin <a> elements (covers Header/MobileNav and every other <Link>
 * without needing per-link instrumentation), then clears once the
 * destination route has actually rendered (pathname change) or the safety
 * timeout elapses. Pure CSS/React, no dependency -- see the plan for why
 * this approach was chosen over per-link useLinkStatus().
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjusting state during render (React's documented pattern for reacting
  // to a prop change without an extra render pass) instead of an effect --
  // avoids the cascading-render setState-in-effect lint rule. The pending
  // safety-timeout (if any) is left to fire later; it just calls
  // setVisible(false) again, which is a harmless no-op by then.
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    setVisible(false);
  }

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement)?.closest?.("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setVisible(true);
      timeoutRef.current = setTimeout(() => setVisible(false), MAX_VISIBLE_MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent"
    >
      <div className="h-full w-1/3 animate-[route-progress_1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
