import { cn } from "cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Rendered flush-right on desktop, stacked below the title on mobile. */
  action?: React.ReactNode;
  className?: string;
}

/** The one heading block every page uses, so spacing stays consistent. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * Marks a screen that is scaffolded but not yet implemented, so the structure
 * is browsable without pretending the feature works.
 */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
