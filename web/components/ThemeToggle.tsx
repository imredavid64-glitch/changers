"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "changers-theme";

/** Resolves a theme choice to the actual color scheme (system = follow OS). */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Sun/moon/system toggle for the app chrome. The <html> data-theme attribute is
 * the single source of truth (also set by the no-FOUC script in app/layout.tsx).
 * Mounted with next/dynamic ssr:false so the icon never hydrates from a
 * different theme than the one the layout script applied.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || "system";
  });

  // Follow OS changes while in "system" mode. Only writes the DOM attribute —
  // the icon state is unchanged, so this never triggers a re-render.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (theme === "system") {
        document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
      }
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, [theme]);

  function apply(next: Theme) {
    document.documentElement.dataset.theme = resolveTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setTheme(next);
  }

  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  const label = theme === "dark" ? "Dark" : theme === "system" ? "System" : "Light";

  return (
    <button
      className="ghost theme-toggle"
      onClick={() => apply(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
      title={`Theme: ${label} — click to switch`}
      aria-label={`Color theme: ${label}. Click to switch.`}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px" }}
    >
      <Icon size={16} aria-hidden />
      <span className="theme-toggle-label">{label}</span>
    </button>
  );
}
