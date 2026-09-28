"use client";

import { useSyncExternalStore } from "react";

import {
  getActivityTypesSnapshot,
  getServerActivityTypesSnapshot,
  subscribe,
} from "@/lib/activity-types";
import type { CustomActivityType } from "@/lib/types";

/**
 * The user's custom activity types, or `[]` during the server render.
 *
 * Same shape as `use-theme.ts`, with the same reasoning: React uses
 * `getServerActivityTypesSnapshot` for the server render *and* the hydration
 * pass, then re-renders if the client snapshot differs — so a server that
 * cannot possibly know this device's types does not produce a mismatch.
 *
 * That only holds because the snapshot function returns a cached array. See
 * the note in `lib/activity-types.ts` — a fresh array per call loops forever.
 *
 * To mutate, call `addActivityType` / `updateActivityType` /
 * `deleteActivityType` from `@/lib/activity-types`; they are plain module
 * functions, so no Provider is needed.
 */
export function useActivityTypes(): CustomActivityType[] {
  return useSyncExternalStore(
    subscribe,
    getActivityTypesSnapshot,
    getServerActivityTypesSnapshot
  );
}
