import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { CHROME_COLOR, DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// metadataBase makes relative OG/share URLs absolute. It is a build-time value
// (NEXT_PUBLIC_* is frozen into the output), so changing it needs a rebuild.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} · 一起活动`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_NAME}（${APP_TAGLINE}）——和朋友一起策划、记录、回顾每一场活动。`,
  applicationName: APP_NAME,
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} · 一起活动`,
    description: "和朋友一起策划、记录、回顾每一场活动。",
    locale: "zh_CN",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The shell manages its own safe-area padding; let it paint under the notch.
  viewportFit: "cover",
  // Static default (温馨). The real value is written by THEME_INIT_SCRIPT below
  // and by setTheme() — media queries can't express this, the theme is a
  // stored preference rather than a system setting. Derived from CHROME_COLOR
  // rather than repeated as a literal, so the two can't drift apart.
  themeColor: CHROME_COLOR[DEFAULT_THEME],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      // Next 16 no longer forces `scroll-behavior: smooth` during navigation;
      // opting back in requires this attribute.
      data-scroll-behavior="smooth"
      // Server-rendered default; the script below may overwrite it before paint,
      // which React would otherwise report as an attribute mismatch.
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Must stay the first child of <body>: it runs during parse, before any
            content paints, so a stored theme never flashes the default. Placed
            here rather than in <head> to stay clear of Next's metadata API. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
