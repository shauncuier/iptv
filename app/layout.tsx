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

export const metadata: Metadata = {
  title: "3S-IPTV — Free Live TV Powered by iptv-org",
  description:
    "Stream 8,000+ free live TV channels from iptv-org.github.io. Browse by category, language, or country. Powered by HLS.js and Next.js.",
  applicationName: "3S-IPTV",
  authors: [{ name: "3S-Soft", url: "https://3s-soft.com" }],
  creator: "3S-Soft",
  publisher: "3S-Soft",
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
