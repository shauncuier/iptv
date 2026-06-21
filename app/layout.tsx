import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

// Set NEXT_PUBLIC_SITE_URL to your deployed origin so share-card image URLs
// resolve absolutely (required by Facebook / X / WhatsApp crawlers).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://3s-iptv.vercel.app";
const title = "3S-IPTV — Free Live TV · 8,000+ Channels";
const description =
  "Watch 8,000+ free live TV channels in your browser — sports, news, movies, music and the World Cup. Browse by category, language or country. HLS & MPEG-TS with Chromecast and AirPlay. Designed & developed by 3S-Soft.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · 3S-IPTV" },
  description,
  applicationName: "3S-IPTV",
  authors: [{ name: "3S-Soft", url: "https://3s-soft.com" }],
  creator: "3S-Soft",
  publisher: "3S-Soft",
  category: "entertainment",
  keywords: [
    "IPTV", "live TV", "free TV", "online streaming", "HLS player",
    "World Cup live", "sports streaming", "iptv-org", "watch tv online",
    "m3u player", "3S-Soft", "3S-IPTV",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "3S-IPTV",
    title,
    description,
    url: siteUrl,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@3ssoft",
  },
};

// viewport-fit=cover enables env(safe-area-inset-*) on notched phones; theme
// color tints the mobile browser chrome to match the app background.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080c14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} style={{ height: "100%", overflow: "hidden" }}>
      <body style={{ height: "100%", overflow: "hidden" }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
