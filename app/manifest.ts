import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "3S-IPTV — Free Live TV",
    short_name: "3S-IPTV",
    description:
      "Watch 8,000+ free live TV channels — sports, news, movies and the World Cup. By 3S-Soft.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#080c14",
    theme_color: "#080c14",
    categories: ["entertainment", "news", "sports"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
