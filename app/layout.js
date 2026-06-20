import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata = {
  title: "3S-IPTV — Free Live TV Powered by iptv-org",
  description: "Stream 8,000+ free live TV channels from iptv-org.github.io. Browse by category, language, or country. Powered by HLS.js and Next.js.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} style={{ height: "100%", overflow: "hidden" }}>
      <body style={{ height: "100%", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
