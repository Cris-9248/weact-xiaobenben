/** Display formatting. All user-facing strings here are zh-CN. */

const dateTime = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/**
 * Collapses a range into the shortest unambiguous form:
 * same day → `9月28日 18:00 – 21:00`, otherwise the full both-ends form.
 */
export function formatTimeRange(startsAt: string, endsAt?: string): string {
  const start = new Date(startsAt);
  if (!endsAt) return dateTime.format(start);

  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const endText = sameDay
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(end)
    : dateTime.format(end);

  return `${dateTime.format(start)} – ${endText}`;
}

/** `今天` / `明天` / `昨天` / `3 天后`, relative to the local calendar day. */
export function formatRelativeDay(iso: string): string {
  const target = new Date(iso);
  const today = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const days = Math.round(
    (startOfDay(target) - startOfDay(today)) / 86_400_000
  );

  if (days === 0) return "今天";
  if (days === 1) return "明天";
  if (days === -1) return "昨天";
  if (days > 1 && days <= 7) return `${days} 天后`;
  if (days < -1 && days >= -7) return `${-days} 天前`;
  return `${dateOnly.format(target)} ${weekday.format(target)}`;
}

export function formatCurrency(yuan: number): string {
  return `¥${yuan.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export function formatPerPerson(yuan: number): string {
  return `${formatCurrency(yuan)}/人`;
}

/** `0:07` — voice-note length. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
