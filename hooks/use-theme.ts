"use client";

import { useSyncExternalStore } from "react";

import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  subscribe,
  type Theme,
} from "@/lib/theme";

/**
 * Reads the active theme from the DOM.
 *
 * `useSyncExternalStore` is a deliberate choice over Context + `useEffect`:
 * React uses `getServerThemeSnapshot` for the server render *and* the hydration
 * pass, then immediately re-renders if the client snapshot differs. That makes
 * a hydration mismatch structurally impossible, without a `mounted` flag.
 *
 * To change the theme, call `setTheme` from `@/lib/theme` — it is a plain
 * module function, so no Context or Provider is needed.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getThemeSnapshot, getServerThemeSnapshot);
}
