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

// Sports channels / dedicated sports broadcasters likely to carry the World
// Cup. The "World Cup" filter is really "channels that show football", so we
// match SPORTS networks — NOT generalist carriers like BBC One / RAI 1 / TF1,
// which technically air the final but would flood the list with news and
// entertainment. Brands without the literal word "sport" are listed explicitly;
// anything whose name or group simply contains "sport" is caught separately.
const SPORTS_BRAND_RE = new RegExp(
  [
    "bein", "espn", "\\btudn\\b", "\\btsn\\b", "\\brds\\b", "\\bdazn\\b",   // global / Americas
    "telemundo", "universo", "fox\\s?sports", "\\bfs[12]\\b",               // USA
    "azteca deportes", "sky\\s?sport", "\\bgol\\s?tv\\b", "tigo sports",    // LatAm / Mexico
    "sportv", "\\bdsports?\\b", "directv sports", "tyc sports", "espn deportes",
    "supersport", "\\bssc\\b", "dubai\\s?sports", "ad\\s?sports",           // Africa / MENA
    "abu dhabi sports", "alkass", "\\bdmc sport",
    "star\\s?sports", "sony\\s?sports", "sports\\s?18", "willow",           // India / Asia
    "optus\\s?sport", "premier\\s?sports", "setanta", "viaplay",            // Oceania / Europe
    "euro\\s?sport", "arena\\s?sport", "sport\\s?tv", "nova\\s?sport",
    "match\\s?tv", "v\\s?sport",
  ].join("|"),
  "i"
);

// A channel is "World Cup" if it is literally named after the tournament, OR it
// is a sports channel (group/name says "sport(s)"), OR it is one of the known
// sports broadcasters above.
export function isWorldCupChannel(c: {
  name: string;
  group: string;
  tvgId: string;
}): boolean {
  const hay = `${c.name} ${c.group} ${c.tvgId}`;
  if (WORLD_CUP_RE.test(hay)) return true;
  if (/\bsports?\b/i.test(`${c.name} ${c.group}`)) return true; // "Sky Sports", group "Sports"
  return SPORTS_BRAND_RE.test(c.name);
}
