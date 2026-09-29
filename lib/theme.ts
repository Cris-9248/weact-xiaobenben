/**
 * Theme store. Deliberately framework-free — the React binding lives in
 * `hooks/use-theme.ts` so this file stays importable anywhere.
 *
 * The source of truth is the `data-theme` attribute on <html>, NOT React state:
 * an inline script in the root layout sets it before first paint, so the DOM is
 * always ahead of React and reading from it is what keeps the two in sync.
 */

/**
 * The single source of truth for which themes exist. The union type below,
 * `isTheme()`, and the inline script at the bottom of this file all derive from
 * this array — so adding a theme here is enough for the data layer.
 *
 * Order is load-bearing: it is the order `ThemeToggle` renders them in.
 *
 * The three are *not* a light/dark pair plus an extra. `dark:` in globals.css
 * is aliased to the cool theme alone, so warm and business are both light
 * presentations that deliberately receive none of the `dark:` overrides.
 */
export const THEMES = ["warm", "cool", "business"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "weact-theme";
export const DEFAULT_THEME: Theme = "warm";

/**
 * Mirrors `--background` in globals.css. Hex rather than oklch because
 * <meta name="theme-color"> support for oklch is not universal.
 *
 * Exported so layout.tsx can derive its `viewport.themeColor` from the same
 * table instead of repeating the warm value as a second literal.
 */
export const CHROME_COLOR: Record<Theme, string> = {
  warm: "#fffdfa",
  cool: "#12141c",
  business: "#fafafa",
};

const listeners = new Set<() => void>();

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
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
 *
 * The valid-theme list and the chrome colours are *interpolated from THEMES
 * and CHROME_COLOR* rather than written out here. TypeScript cannot check a
 * string, so hand-written literals in this function are the classic silent
 * failure: the old two-way `t==="cool"?…:…` ternary meant a third theme would
 * have kept warm's chrome colour even after passing the validity check.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var ok=${JSON.stringify(THEMES)};if(ok.indexOf(t)<0){t=${JSON.stringify(
  DEFAULT_THEME
)};}var r=document.documentElement;r.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",${JSON.stringify(
  CHROME_COLOR
)}[t]||"");}}catch(e){}})();`;
