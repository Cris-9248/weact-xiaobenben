import { notFound } from "next/navigation";
import { BedDouble, ExternalLink, Plane } from "lucide-react";

import { StalenessBadge } from "@/components/activity/staleness-badge";
import { TravelGate } from "@/components/activity/travel-gate";
import { Placeholder } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { activities, travelQuotes } from "@/lib/mock-data";
import type { TravelQuote } from "@/lib/types";

export const metadata = { title: "交通 · 住宿" };

export default async function ActivityTravelPage(
  props: PageProps<"/activities/[id]/travel">
) {
  const { id } = await props.params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) notFound();

  const transport = travelQuotes.filter((q) => q.kind === "transport");
  const lodging = travelQuotes.filter((q) => q.kind === "lodging");

  // The gate resolves `needsTravel` client-side (custom types live in
  // localStorage); everything below stays server-rendered and is passed
  // through as children.
  return (
    <TravelGate type={activity.type}>
      <div className="space-y-6">
        <Section icon={<Plane className="size-4" />} title="交通" quotes={transport} />
        <Section icon={<BedDouble className="size-4" />} title="住宿" quotes={lodging} />

        <Placeholder>
          待接入：对接航班/车次与酒店比价接口，定时刷新并标注价格变动。
          目前是静态示例数据，不反映真实价格。
        </Placeholder>
      </div>
    </TravelGate>
  );
}

function Section({
  icon,
  title,
  quotes,
}: {
  icon: React.ReactNode;
  title: string;
  quotes: TravelQuote[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        {icon}
        {title}
      </h2>
      {quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无{title}信息。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {quotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} />
          ))}
        </div>
      )}
    </section>
  );
}

function QuoteCard({ quote }: { quote: TravelQuote }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        {/* 价格已经 `shrink-0` 了，缺的是左边：航班/车次那种标题可以很长。 */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-medium">{quote.title}</p>
            {quote.provider ? (
              <p className="truncate text-xs text-muted-foreground">
                {quote.provider}
              </p>
            ) : null}
          </div>
          {quote.price ? (
            <p className="shrink-0 font-heading text-base font-semibold tabular-nums">
              {formatCurrency(quote.price)}
            </p>
          ) : null}
        </div>

        {quote.fromLabel && quote.toLabel ? (
          <p className="text-sm text-muted-foreground">
            {quote.fromLabel} → {quote.toLabel}
          </p>
        ) : null}

        {quote.departAt ? (
          <p className="text-xs text-muted-foreground">
            {formatDateTime(quote.departAt)}
            {quote.arriveAt ? ` – ${formatDateTime(quote.arriveAt)}` : ""}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <StalenessBadge fetchedAt={quote.fetchedAt} />
          {quote.bookingUrl ? (
            // An external link styled as a button — see the note in
            // `activities/page.tsx` for why this is not a `<Button render>`.
            <a
              href={quote.bookingUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              去预订
              <ExternalLink data-icon="inline-end" />
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
