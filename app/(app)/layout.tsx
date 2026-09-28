import { AppShell } from "@/components/layout/app-shell";

/**
 * Signed-in routes. Once auth lands, this layout (or `proxy.ts`) is where the
 * session check goes — but note it is only an optimistic gate: every Server
 * Action still has to re-verify the session and row ownership itself.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
