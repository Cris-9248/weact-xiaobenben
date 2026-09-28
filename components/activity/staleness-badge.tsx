"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

/** Quotes go stale fast, so the badge re-checks on an interval. */
const STALE_AFTER_MS = 60 * 60 * 1000;
const RECHECK_MS = 60 * 1000;

/**
 * Client-side because it reads the clock: doing that during render would make
 * the server and client disagree. The first client render matches the server
 * (both show "fresh"); the effect then corrects it after hydration.
 */
export function StalenessBadge({ fetchedAt }: { fetchedAt: string }) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const check = () =>
      setStale(Date.now() - new Date(fetchedAt).getTime() > STALE_AFTER_MS);
    check();
    const id = setInterval(check, RECHECK_MS);
    return () => clearInterval(id);
  }, [fetchedAt]);

  return (
    <Badge variant={stale ? "destructive" : "outline"}>
      {stale ? "价格可能已变动" : "刚刚更新"}
    </Badge>
  );
}
