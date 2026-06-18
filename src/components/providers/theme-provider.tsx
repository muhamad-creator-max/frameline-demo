"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme, type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}

/**
 * Mirrors `next-themes`' class onto a `data-theme` attribute and pulses the
 * `theme-switching` class for one frame so backgrounds don't animate
 * during a theme swap. Matches the Frameline design's pattern exactly.
 */
function ThemeSync() {
  const { resolvedTheme } = useTheme();
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", resolvedTheme === "dark" ? "dark" : "light");
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("theme-switching")),
    );
    return () => cancelAnimationFrame(id);
  }, [resolvedTheme]);
  return null;
}
