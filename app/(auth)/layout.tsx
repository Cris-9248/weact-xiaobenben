import Link from "next/link";

import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { ThemeToggle } from "@/components/theme-toggle";

/** Unauthenticated chrome: no nav, no shell — just a centred column. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      {/* Fixed so it stays reachable on short viewports without disturbing the
          vertical centring of the form. */}
      <ThemeToggle
        variant="compact"
        className="fixed top-4 right-4 z-30"
      />
      <Link href="/" className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-9 place-items-center rounded-xl bg-primary px-2.5 text-sm font-bold tracking-tight text-primary-foreground">
          We
        </span>
        <span className="space-y-1">
          <p className="font-heading text-2xl font-semibold tracking-tight">
            {APP_NAME}
          </p>
          <p className="block text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
