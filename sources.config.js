// =============================================================================
//  M3U Sources Configuration
// =============================================================================
//  Add as many M3U playlist URLs as you like — one line each.
//  On startup (and when you click "All Configured Sources" in the Playlist
//  Manager), the app fetches EVERY source here, merges all channels into one
//  searchable list, and deduplicates by stream URL.
//
//  To add a source: copy a line and change the name + url. That's it.
//  To disable a source temporarily: delete the line, or comment it out with //
//  To use a LOCAL file instead of a URL: open the Upload tab in the app
//  (URLs only are supported here — local files can't be referenced by URL).
//
//  Format:   { name: "Friendly Name", url: "https://...playlist.m3u" },
//
//  NOTE: iptv-org's index.m3u already contains ALL its channels, so adding
//  iptv-org country/category/language subsets won't add new channels (the
//  dedup step just skips them). The independent community repos below DO add
//  channels that aren't in iptv-org. See commented alternatives at the bottom.
// =============================================================================

const IPTV_SOURCES = [
  // ── iptv-org (the master public collection) ─────────────────────────────
  // { name: "iptv-org Full Index", url: "https://iptv-org.github.io/iptv/index.m3u" },

  // ── Independent community collections (channels NOT in iptv-org) ────────
  // { name: "Free-TV Worldwide",   url: "https://raw.githubusercontent.com/free-tv/iptv/master/playlist.m3u8" },
  // { name: "jromero88 — IPTV",    url: "https://raw.githubusercontent.com/jromero88/iptv/master/IPTV.m3u" },
  // { name: "jromero88 — Channels",url: "https://raw.githubusercontent.com/jromero88/iptv/master/channels.m3u" },
  // { name: "jromero88 — OTT",     url: "https://raw.githubusercontent.com/jromero88/iptv/master/ottplayer.m3u" },

  // ── Other community sources ──────────────────────────────────────────────
  // { name: "Lupael IPTV",         url: "https://lupael.github.io/IPTV/running.m3u" },
  // { name: "Mrgify BDIX IPTV",    url: "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/playlist.m3u" },
  // { name: "Romaxa55 World IPTV", url: "https://romaxa55.github.io/world_ip_tv/output/index.m3u" },
  // { name: "JagoBD Bangladeshi",  url: "https://raw.githubusercontent.com/tahsinulmohsin/jagobd-m3u8-scraper/master/playlist.m3u8" },

  // ── ⚽ Sports / World Cup focused ─────────────────────────────────────────
  //  These surface in the app's "World Cup" tab automatically — any channel
  //  whose name/group/tvg-id matches FIFA, World Cup, mundial, sports, beIN,
  //  ESPN, etc. shows up there when you toggle the World Cup filter.
  // { name: "iptv-org Sports",        url: "https://iptv-org.github.io/iptv/categories/sports.m3u" },
  // { name: "BeIN Sports (big)",       url: "https://gist.githubusercontent.com/Dev-Gaminger010/36540530e38d3309000f6ff7a0c65f5f/raw" },
  // { name: "Sports Mix (Randall)",    url: "https://gist.githubusercontent.com/ItsRandall/3119615c8b4732d7b56e5217d66edbab/raw" },
  // { name: "BeIN Sports FR",          url: "https://gist.githubusercontent.com/regragi-younes/a77b56c45b3c086cc166b79d5cc45e4a/raw" },
  // { name: "Sports (Fazzani)",        url: "https://gist.githubusercontent.com/Fazzani/722f67c30ada8bac4602f62a2aaccff6/raw" },

  // ── 📺 FAST Channels (via BuddyChewChew) ───────────────────────────────────
  // { name: "Pluto TV (US)",          url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plutotv_us.m3u" },
  // { name: "Pluto TV (All Regions)",  url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plutotv_all.m3u" },
  // { name: "Samsung TV Plus (US)",   url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/samsungtvplus_us.m3u" },
  // { name: "Samsung TV Plus (All)",  url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/samsungtvplus_all.m3u" },
  // { name: "Roku Channels (All)",    url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u" },
  // { name: "Tubi TV Channels (All)", url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u" },
  // { name: "Plex TV Channels (All)", url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plexs_all.m3u" },

  // {
  //   name: "Skym3u", 
  //   url: "https://go.skym3u.top/is8m.m3u"
  // },

  // ── More iptv-org index views (alternative organizations of the same set) ─
  // { name: "iptv-org by Country",  url: "https://iptv-org.github.io/iptv/index.country.m3u" },
  // { name: "iptv-org by Language", url: "https://iptv-org.github.io/iptv/index.language.m3u" },
  // { name: "iptv-org by Category", url: "https://iptv-org.github.io/iptv/index.category.m3u" },

  // ── iptv-org country subsets (only useful if you REMOVE index.m3u above) ─
  // { name: "iptv-org USA",         url: "https://iptv-org.github.io/iptv/countries/us.m3u" },
  // { name: "iptv-org UK",           url: "https://iptv-org.github.io/iptv/countries/uk.m3u" },
  // { name: "iptv-org India",        url: "https://iptv-org.github.io/iptv/countries/in.m3u" },

  // ── iptv-org category subsets (only useful if you REMOVE index.m3u above) ─
  // { name: "iptv-org Sports",       url: "https://iptv-org.github.io/iptv/categories/sports.m3u" },
  // { name: "iptv-org News",         url: "https://iptv-org.github.io/iptv/categories/news.m3u" },
  // { name: "iptv-org Movies",       url: "https://iptv-org.github.io/iptv/categories/movies.m3u" },

  // ── iptv-org language subsets ─────────────────────────────────────────────
  // { name: "iptv-org English",      url: "https://iptv-org.github.io/iptv/languages/eng.m3u" },

  // Leave the array empty [] if you'd rather use the single-source presets
  // in the Playlist Manager instead of auto-merging multiple sources.
];

export default IPTV_SOURCES;
