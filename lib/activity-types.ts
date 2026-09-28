/**
 * Custom activity type store. Deliberately framework-free, like `lib/theme.ts`
 * — the React binding lives in `hooks/use-activity-types.ts` so this file stays
 * importable anywhere.
 *
 * Unlike the theme, the persisted value is a *collection*, which forces two
 * departures from that file's shape:
 *
 * 1. `getActivityTypesSnapshot` must return a **referentially stable** array.
 *    `useSyncExternalStore` re-renders whenever the snapshot changes identity,
 *    so parsing localStorage on every call would loop forever. Hence the
 *    module-level `cached`, replaced only when a write happens.
 * 2. There is no DOM attribute to use as the source of truth — localStorage
 *    itself is it, read once and then held in `cached`.
 *
 * There is no blocking init script here, and that is deliberate: the theme's
 * inline script exists to stop a full-page color flash. The worst case here is
 * one badge rendering its fallback for a frame, and a blocking script could not
 * rewrite the already-server-rendered HTML anyway.
 */

import {
  ACTIVITY_TYPE_ACCENT_PALETTE,
  BUILT_IN_ACTIVITY_TYPE_META,
  UNKNOWN_ACTIVITY_TYPE_META,
  isBuiltInActivityType,
} from "@/lib/constants";
import type { ActivityType, ActivityTypeMeta, CustomActivityType } from "@/lib/types";

export const ACTIVITY_TYPES_STORAGE_KEY = "weact-activity-types";

/** Max label length. Guards against a pasted novel blowing out a badge. */
const MAX_LABEL_LENGTH = 12;

const listeners = new Set<() => void>();

/** The one stable reference callers get. `null` means "not read yet". */
let cached: CustomActivityType[] | null = null;

/** `getServerSnapshot` must return the identical reference every call, or the
 *  hydration pass loops. Never hand out a fresh `[]`. */
const EMPTY: CustomActivityType[] = [];

/* ------------------------------- 解析（读） ------------------------------- */

/**
 * The single entry point for turning an activity's `type` into something
 * renderable. Every lookup goes through here.
 *
 * This exists because widening `ActivityType` to `string` removed the
 * compiler's ability to catch a bad key: `tsconfig.json` does not set
 * `noUncheckedIndexedAccess`, so `TABLE[type]` types as present even when it
 * is not, and the old direct lookups would have rendered an empty badge and
 * the literal text "undefined 次" rather than failing loudly.
 *
 * An unresolvable type is not an error. The activity still exists — its type
 * was deleted, or was created on another device — so it degrades to a neutral
 * badge instead of crashing or rendering blank.
 */
export function resolveActivityType(
  type: ActivityType,
  customTypes: CustomActivityType[]
): ActivityTypeMeta {
  if (isBuiltInActivityType(type)) return BUILT_IN_ACTIVITY_TYPE_META[type];

  const custom = customTypes.find((t) => t.id === type);
  if (!custom) return { ...UNKNOWN_ACTIVITY_TYPE_META, id: type };

  return {
    id: custom.id,
    label: custom.label,
    accent:
      ACTIVITY_TYPE_ACCENT_PALETTE[
        custom.paletteIndex % ACTIVITY_TYPE_ACCENT_PALETTE.length
      ],
    needsTravel: custom.needsTravel,
  };
}

/* ------------------------------- 持久化 ------------------------------- */

/** localStorage is user-editable, so every record is shape-checked on read. A
 *  corrupt entry is dropped rather than allowed to break the page. */
function isWellFormed(value: unknown): value is CustomActivityType {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    t.id.length > 0 &&
    // Defence in depth: a hand-edited payload claiming `id: "travel"` must not
    // be able to shadow a locked built-in. `resolveActivityType` checks
    // built-ins first anyway, so this is belt-and-braces, not the only guard.
    !isBuiltInActivityType(t.id) &&
    typeof t.label === "string" &&
    t.label.length > 0 &&
    typeof t.paletteIndex === "number" &&
    Number.isInteger(t.paletteIndex) &&
    t.paletteIndex >= 0 &&
    typeof t.needsTravel === "boolean"
  );
}

function readFromStorage(): CustomActivityType[] {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_TYPES_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const valid = parsed.filter(isWellFormed);
    return valid.length > 0 ? valid : EMPTY;
  } catch {
    // Corrupt JSON or storage disabled (private mode) — start from empty
    // rather than taking the page down.
    return EMPTY;
  }
}

function commit(next: CustomActivityType[]): void {
  cached = next;
  try {
    window.localStorage.setItem(ACTIVITY_TYPES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or quota — the change still applies for this session.
  }
  for (const listener of listeners) listener();
}

/* ------------------------------- 订阅 ------------------------------- */

/**
 * Called when another tab writes the same key. Unlike the theme store — which
 * is immune by accident, because it re-reads a DOM attribute the other tab
 * already changed — a cached list would otherwise go stale until reload. So
 * drop the cache and let the next snapshot re-read.
 */
function handleStorageEvent(event: StorageEvent): void {
  if (event.key !== ACTIVITY_TYPES_STORAGE_KEY) return;
  cached = null;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Attached on the first subscriber and removed on the last, so this module
  // never holds a listener nobody is reading.
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageEvent);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageEvent);
    }
  };
}

export function getActivityTypesSnapshot(): CustomActivityType[] {
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getServerActivityTypesSnapshot(): CustomActivityType[] {
  // The server cannot know this device's types, so it renders built-ins only
  // and React corrects after hydration if the client snapshot differs.
  return EMPTY;
}

/* ------------------------------- 写 ------------------------------- */

/** Not derived from the label, so renaming never orphans an activity. */
function createId(): string {
  // `crypto.randomUUID` is gated behind a secure context and is therefore
  // `undefined` when this app is self-hosted over plain http:// on a LAN
  // address — a supported deployment. Timestamp + random works everywhere.
  return `ct_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Next palette slot. Deliberately *not* `customTypes.length`: deleting a type
 *  would shrink the length and hand the next one a color already in use.
 *  Walking past the highest index means the palette only repeats once the user
 *  has genuinely cycled through it. */
export function nextPaletteIndex(customTypes: CustomActivityType[]): number {
  if (customTypes.length === 0) return 0;
  const highest = Math.max(...customTypes.map((t) => t.paletteIndex));
  return (highest + 1) % ACTIVITY_TYPE_ACCENT_PALETTE.length;
}

/** Returns the created record so callers (e.g. the activity form) can select
 *  it immediately. */
export function addActivityType(
  label: string,
  needsTravel: boolean
): CustomActivityType {
  const current = getActivityTypesSnapshot();
  const created: CustomActivityType = {
    id: createId(),
    label: label.trim().slice(0, MAX_LABEL_LENGTH),
    paletteIndex: nextPaletteIndex(current),
    needsTravel,
  };
  commit([...current, created]);
  return created;
}

/** `id` is stable, so this is safe even for types that activities reference. */
export function updateActivityType(
  id: string,
  patch: { label?: string; needsTravel?: boolean }
): void {
  const current = getActivityTypesSnapshot();
  commit(
    current.map((t) =>
      t.id === id
        ? {
            ...t,
            ...(patch.label !== undefined
              ? { label: patch.label.trim().slice(0, MAX_LABEL_LENGTH) }
              : {}),
            ...(patch.needsTravel !== undefined
              ? { needsTravel: patch.needsTravel }
              : {}),
          }
        : t
    )
  );
}

/** Removes the type only. Activities referencing it are left alone and fall
 *  back to `UNKNOWN_ACTIVITY_TYPE_META` — deleting them silently would be
 *  far worse. */
export function deleteActivityType(id: string): void {
  const current = getActivityTypesSnapshot();
  commit(current.filter((t) => t.id !== id));
}

/** True when `label` is already used by a built-in or another custom type.
 *  `exceptId` lets the edit dialog ignore the record being edited. */
export function isLabelTaken(
  label: string,
  customTypes: CustomActivityType[],
  exceptId?: string
): boolean {
  const needle = label.trim();
  if (!needle) return false;
  const builtIn = Object.values(BUILT_IN_ACTIVITY_TYPE_META).some(
    (meta) => meta.label === needle
  );
  return (
    builtIn ||
    customTypes.some((t) => t.id !== exceptId && t.label === needle)
  );
}
