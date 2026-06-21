import parser from "iptv-playlist-parser";
import type { Channel } from "./types";

/**
 * Parse raw M3U text into typed Channel objects. Tolerant of leading junk
 * before the #EXTM3U header (some servers prepend whitespace / BOM / HTML).
 */
export function parseM3U(text: string): Channel[] {
  try {
    let cleanText = text;
    const extm3uIndex = text.indexOf("#EXTM3U");
    if (extm3uIndex !== -1) cleanText = text.substring(extm3uIndex);

    const playlist = parser.parse(cleanText);
    return playlist.items.map((item) => {
      const countryMatch =
        item.raw.match(/tvg-country="([^"]*)"/i) || item.raw.match(/tvg-country=([^ ]*)/i);
      const languageMatch =
        item.raw.match(/tvg-language="([^"]*)"/i) || item.raw.match(/tvg-language=([^ ]*)/i);

      return {
        name: item.name || "Stream",
        logo: item.tvg.logo || "",
        group: item.group.title || "Undefined",
        tvgId: item.tvg.id || "",
        country: countryMatch ? countryMatch[1] : "",
        language: languageMatch ? languageMatch[1] : "",
        isGeoBlocked: item.raw.toLowerCase().includes("geo-blocked"),
        not247: item.raw.toLowerCase().includes("not 24/7"),
        url: item.url,
      };
    });
  } catch (err) {
    console.error("Failed to parse playlist with iptv-playlist-parser:", err);
    return [];
  }
}

// World Cup channel matcher — name / group / tvg-id keywords across languages.
const WORLD_CUP_RE =
  /world\s*cup|worldcup|fifa|wc\s?20?26|copa\s*mundial|coupe\s*du\s*monde|mundial|weltmeisterschaft/i;

// Official 2026 World Cup broadcasters / rights-holders by territory. These are
// general networks that CARRY the tournament (vs channels literally named
// "World Cup"). Leans toward sports-branded networks to limit false positives;
// the few generalist carriers (BBC/ITV/RAI/Globo…) are noisier but official.
const WC_BROADCASTER_RE = new RegExp(
  [
    // North America (hosts)
    "fox sports", "\\bfs1\\b", "\\bfs2\\b", "telemundo", "universo", "peacock", // USA
    "\\btsn\\b", "\\bctv\\b", "\\brds\\b", // Canada
    "televisa", "\\btudn\\b", "tv azteca", "azteca deportes", "sky m[eé]xico", // Mexico
    // Latin America
    "\\bglobo\\b", "sportv", "\\bdsports\\b", "directv sports", "caracol", "\\brcn\\b",
    "\\bgol\\s?tv\\b", "tigo sports",
    // Europe
    "\\bbbc\\b", "\\bitv\\b", // UK
    "\\brai\\b", // Italy
    "\\btf1\\b", "\\bm6\\b", // France
    "\\bard\\b", "\\bzdf\\b", "magenta", // Germany
    "mediaset", "telecinco", // Spain
    // MENA / Africa / Asia-Pacific
    "bein", "bein sports", // MENA
    "supersport", // Sub-Saharan Africa
    "optus sport", "\\bsbs\\b", // Australia
    "sports\\s?18", "jiocinema", "viacom\\s?18", // India
    "\\bnhk\\b", // Japan
  ].join("|"),
  "i"
);

export function isWorldCupChannel(c: {
  name: string;
  group: string;
  tvgId: string;
}): boolean {
  const hay = `${c.name} ${c.group} ${c.tvgId}`;
  return WORLD_CUP_RE.test(hay) || WC_BROADCASTER_RE.test(hay);
}
