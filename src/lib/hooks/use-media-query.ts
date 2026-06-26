"use client";

import * as React from "react";

/**
 * Subscribe to a CSS media query. SSR-safe (returns `false` until mounted, so
 * the server and first client render agree — desktop layout — then it corrects
 * on mount). Needed because the review UI is styled with inline styles, which
 * CSS media queries can't reach, so layout has to branch in JS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Phones / small tablets in portrait. Matches the review page's stacked layout. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}
