/**
 * Theme store. Deliberately framework-free — the React binding lives in
 * `hooks/use-theme.ts` so this file stays importable anywhere.
 *
 * The source of truth is the `data-theme` attribute on <html>, NOT React state:
 * an inline script in the root layout sets it before first paint, so the DOM is
 * always ahead of React and reading from it is what keeps the two in sync.
 */

export type Theme = "warm" | "cool";

export const THEME_STORAGE_KEY = "weact-theme";
export const DEFAULT_THEME: Theme = "warm";

/**
 * Mirrors `--background` in globals.css. Hex rather than oklch because
 * <meta name="theme-color"> support for oklch is not universal.
 */
const CHROME_COLOR: Record<Theme, string> = {
  warm: "#fffdfa",
  cool: "#12141c",
};

const listeners = new Set<() => void>();

export function isTheme(value: unknown): value is Theme {
  return value === "warm" || value === "cool";
}

/** Paints the theme onto the document. Safe to call before hydration. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", CHROME_COLOR[theme]);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThemeSnapshot(): Theme {
  const current = document.documentElement.dataset.theme;
  return isTheme(current) ? current : DEFAULT_THEME;
}

/**
 * What the server (and therefore the hydration pass) assumes. Must equal the
 * default in the inline script and the `data-theme` on <html> in layout.tsx.
 */
export function getServerThemeSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or storage disabled — the theme still applies this session.
  }
  for (const listener of listeners) listener();
}

/**
 * Runs before first paint, as the first child of <body>. Kept as a string
 * because it has to be inlined into the document rather than bundled.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t!=="warm"&&t!=="cool"){t=${JSON.stringify(
  DEFAULT_THEME
)};}var r=document.documentElement;r.dataset.theme=t;var c=t==="cool"?${
  JSON.stringify(CHROME_COLOR.cool)
}:${JSON.stringify(
  CHROME_COLOR.warm
)};var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",c);}}catch(e){}})();`;
