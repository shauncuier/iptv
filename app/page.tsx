"use client";

import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import IPTV_SOURCES from "@/sources.config.js";
import {
  Tv, Search, X, Settings, List, Folder, Heart, Film, Newspaper,
  Trophy, Music, Smile, Church, CloudSun, ShoppingCart, GraduationCap,
  Play, Pause, Volume2, VolumeX, Volume1, PictureInPicture2, Maximize,
  AlertTriangle, RefreshCw, PlayCircle, Globe, History, Copy, ExternalLink,
  Link as LinkIcon, UploadCloud, Upload, FileText, Trash2, CheckCircle,
  AlertOctagon, HelpCircle, Tv2, Tag, MapPin, Languages, Zap, Star,
  Car, Briefcase, Clock, Utensils, Landmark, Baby, Scale, Leaf,
  FlaskConical, Plane, Wifi, BookOpen, Menu, Activity,
  Cast, Airplay, Loader2, Sun
} from "lucide-react";

import CategoryIcon from "./components/CategoryIcon";
import ChannelLogo from "./components/ChannelLogo";
import VideoPlayer from "./components/VideoPlayer";
import BrowsePanel from "./components/BrowsePanel";
import PlaylistModal from "./components/PlaylistModal";
import { parseM3U, isWorldCupChannel } from "./lib/m3u";
import { getCachedPlaylist, setCachedPlaylist } from "./lib/cache";
import { checkStreamStatus, flagEmoji } from "./lib/stream";
import { DEFAULT_PLAYLIST, IPTV_ORG_CATEGORIES, IPTV_ORG_LANGUAGES, IPTV_ORG_COUNTRIES, WORLD_CUP_PINS } from "./lib/constants";
import type { Channel, StreamStatusValue } from "./lib/types";
import { usePlayer } from "./hooks/usePlayer";

export default function IPTVPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeTab, setActiveTab] = useState("channels");
  const [currentCategory, setCurrentCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showWorldCup, setShowWorldCup] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const PAGE_SIZE = 80;


  const [playlistUrl, setPlaylistUrl] = useState(DEFAULT_PLAYLIST);
  const [customUrlInput, setCustomUrlInput] = useState(DEFAULT_PLAYLIST);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState("sources");
  const [selectedFile, setSelectedFile] = useState(null);
  const [activePresetUrl, setActivePresetUrl] = useState(DEFAULT_PLAYLIST);
  const [isPlaylistLoading, setIsPlaylistLoading] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [multiLoadProgress, setMultiLoadProgress] = useState(null);
  const [loadAllSources, setLoadAllSources] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const [toasts, setToasts] = useState([]);
  const [streamStatus, setStreamStatus] = useState<Record<string, StreamStatusValue>>({});
  const streamStatusRef = useRef<Record<string, StreamStatusValue>>({});

  const checkedRef = useRef(new Set());
  const loaderRef = useRef(null);
  const fileInputRef = useRef(null);

  // Transient toast notifications — defined early so usePlayer can receive it.
  const addToast = (message: string, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };

  // Player engine + UI state lives in the usePlayer hook. The whole object is
  // handed to <VideoPlayer>; the page itself only needs isPlaying (tab title,
  // channel-card equaliser).
  const player = usePlayer({ activeChannel, addToast, setStreamStatus });
  const { isPlaying } = player;

  const [localPlaylists, setLocalPlaylists] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const saveToCache = async (chList, url) => {
    await setCachedPlaylist("channels", chList);
    await setCachedPlaylist("playlistUrl", url);
    await setCachedPlaylist("cacheTimestamp", Date.now());
  };

  async function fetchLocalPlaylists() {
    try {
      const res = await fetch("/api/playlists");
      if (res.ok) {
        const data = await res.json();
        setLocalPlaylists(data.playlists || []);
      }
    } catch (err) {
      console.error("Failed to load local playlists:", err);
    }
  }

  // Merge many M3U sources at once. Fetches each through the same proxy as
  // fetchPlaylist, runs them in a small concurrency batch, and dedupes by
  // stream URL so overlapping sources (e.g. several iptv-org variants) don't
  // double-list channels. One dead URL is reported and skipped, not fatal.
  async function fetchMultiplePlaylists(sources) {
    const list = sources.filter(s => s && s.url);
    if (!list.length) { addToast("No sources configured", "error"); return; }
    setIsPlaylistLoading(true);
    setMultiLoadProgress({ done: 0, total: list.length });
    addToast(`Loading ${list.length} source${list.length > 1 ? "s" : ""}…`, "info");

    const CONCURRENCY = 5;
    let done = 0;
    let okCount = 0;
    const failed = [];
    const merged = [];
    const seen = new Set();

    // Fetch + parse a single source, pushing deduped channels into `merged`.
    const loadOne = async (src) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 30000);
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(src.url)}`, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseM3U(await res.text());
        for (const ch of parsed) {
          if (!ch.url || seen.has(ch.url)) continue;
          seen.add(ch.url);
          merged.push(ch);
        }
        okCount++;
      } catch (e) {
        failed.push(src.name || src.url);
      } finally {
        done++;
        setMultiLoadProgress({ done, total: list.length });
      }
    };

    // Run in batches of CONCURRENCY to avoid hammering the proxy.
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      await Promise.all(list.slice(i, i + CONCURRENCY).map(loadOne));
    }

    setMultiLoadProgress(null);
    if (!merged.length) {
      addToast("No channels loaded from any source.", "error");
    } else {
      setChannels(merged);
      const urlText = `All Sources (${list.length})`;
      setPlaylistUrl(urlText);
      saveToCache(merged, urlText);
      setSearchQuery(""); setCurrentCategory(null); setPage(1);
      checkedRef.current.clear();
      const fresh = {}; streamStatusRef.current = fresh; setStreamStatus(fresh);
      const base = `Loaded ${merged.length.toLocaleString()} channels from ${okCount}/${list.length} sources`;
      addToast(failed.length ? `${base}. Failed: ${failed.join(", ")}` : `${base}!`, failed.length ? "info" : "success");
    }
    setIsPlaylistLoading(false);
  }

  const handleSyncSources = () => {
    if (IPTV_SOURCES && IPTV_SOURCES.length) {
      fetchMultiplePlaylists(IPTV_SOURCES);
    } else {
      setChannels([]);
      addToast("No configured sources to sync.", "info");
    }
  };

  const [scanState, setScanState] = useState({
    isScanning: false,
    checkedCount: 0,
    totalCount: 0,
    onlineCount: 0,
    offlineCount: 0,
  });
  const isScanCancelledRef = useRef(false);

  const startLivenessScan = async (channelsToScan) => {
    if (scanState.isScanning || !channelsToScan.length) return;

    isScanCancelledRef.current = false;
    setScanState({
      isScanning: true,
      checkedCount: 0,
      totalCount: channelsToScan.length,
      onlineCount: 0,
      offlineCount: 0,
    });

    // Auto-enable "Show Only Active" filter so non-working ones are hidden
    setShowOnlyActive(true);

    addToast(`Starting liveness scan for ${channelsToScan.length} channels...`, "info");

    const CONCURRENCY = 15;
    let index = 0;
    let online = 0;
    let offline = 0;

    const scanBatch = async () => {
      if (isScanCancelledRef.current) return;

      const batchPromises = [];
      const batchStart = index;
      const batchEnd = Math.min(index + CONCURRENCY, channelsToScan.length);
      index = batchEnd;

      for (let i = batchStart; i < batchEnd; i++) {
        const ch = channelsToScan[i];

        const promise = (async () => {
          if (isScanCancelledRef.current) return;

          // Set status to checking in state so the dot turns yellow
          setStreamStatus(prev => ({ ...prev, [ch.url]: "checking" }));

          const status = await checkStreamStatus(ch.url);

          if (isScanCancelledRef.current) return;

          if (status === "online") {
            online++;
          } else {
            offline++;
          }

          checkedRef.current.add(ch.url);
          setStreamStatus(prev => {
            const next = { ...prev, [ch.url]: status };
            streamStatusRef.current = next;
            return next;
          });

          setScanState(prev => ({
            ...prev,
            checkedCount: prev.checkedCount + 1,
            onlineCount: online,
            offlineCount: offline,
          }));
        })();

        batchPromises.push(promise);
      }

      await Promise.all(batchPromises);

      if (index < channelsToScan.length && !isScanCancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, 50));
        await scanBatch();
      }
    };

    try {
      await scanBatch();
      if (!isScanCancelledRef.current) {
        addToast(`Scan complete! ${online} active, ${offline} offline channels.`, "success");
      }
    } catch (err) {
      console.error("Scan error:", err);
      addToast("Error during channel scan.", "error");
    } finally {
      setScanState(prev => ({ ...prev, isScanning: false }));
    }
  };

  const cancelLivenessScan = () => {
    isScanCancelledRef.current = true;
    setScanState({
      isScanning: false,
      checkedCount: 0,
      totalCount: 0,
      onlineCount: 0,
      offlineCount: 0,
    });
    addToast("Liveness scan cancelled.", "info");
  };

  // Cancel any active scan on category or playlist change
  useEffect(() => {
    if (scanState.isScanning) {
      setTimeout(() => {
        cancelLivenessScan();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, currentCategory]);

  /* Init */
  useEffect(() => {
    // Load from cache first for instant startup!
    (async () => {
      try {
        const f = localStorage.getItem("iptv_favorites");
        if (f) setFavorites(JSON.parse(f));
        const r = localStorage.getItem("iptv_recents");
        if (r) setRecents(JSON.parse(r));
      } catch {}

      if (!IPTV_SOURCES || IPTV_SOURCES.length === 0) {
        setChannels([]);
        fetchLocalPlaylists();
        return;
      }

      const cached = await getCachedPlaylist<Channel[]>("channels");
      const cachedUrl = await getCachedPlaylist<string>("playlistUrl");
      if (cached && cached.length) {
        setChannels(cached);
        if (cachedUrl) setPlaylistUrl(cachedUrl);
        addToast(`Loaded ${cached.length.toLocaleString()} channels from cache!`, "success");
        // Fetch local playlists library in background
        fetchLocalPlaylists();
      } else {
        fetchLocalPlaylists();
        fetchMultiplePlaylists(IPTV_SOURCES);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = activeChannel && isPlaying
      ? `▶ ${activeChannel.name} | 3S-IPTV`
      : "3S-IPTV — Free Live TV · iptv-org";
  }, [activeChannel, isPlaying]);

  /* Fetch */
  const fetchPlaylist = async (url) => {
    setIsPlaylistLoading(true);
    addToast("Loading playlist…", "info");
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseM3U(text);
      if (!parsed.length) throw new Error("No channels found in playlist.");
      setChannels(parsed);
      setPlaylistUrl(url);
      saveToCache(parsed, url);
      setSearchQuery(""); setCurrentCategory(null); setPage(1);
      checkedRef.current.clear();
      const fresh = {}; streamStatusRef.current = fresh; setStreamStatus(fresh);
      addToast(`Loaded ${parsed.length.toLocaleString()} channels!`, "success");
    } catch (e) {
      addToast(`Failed: ${e.message}`, "error");
    } finally { setIsPlaylistLoading(false); }
  };



  const handleFileUpload = (file) => {
    setIsPlaylistLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseM3U(String(e.target?.result ?? ""));
        if (!parsed.length) throw new Error("No channels found.");
        setChannels(parsed);
        const nameText = `File: ${file.name}`;
        setPlaylistUrl(nameText);
        saveToCache(parsed, nameText);
        setSearchQuery(""); setCurrentCategory(null); setPage(1);
        checkedRef.current.clear();
        const fresh = {}; streamStatusRef.current = fresh; setStreamStatus(fresh);
        addToast(`Loaded ${parsed.length} channels!`, "success");
      } catch (err) { addToast(`Parse error: ${err.message}`, "error"); }
      finally { setIsPlaylistLoading(false); }
    };
    reader.onerror = () => { addToast("File read failed", "error"); setIsPlaylistLoading(false); };
    reader.readAsText(file);
  };



  const uploadAndLoadFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    addToast("Uploading playlist to server...", "info");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      addToast(`Uploaded ${data.name} successfully!`, "success");

      // Refresh the local files library
      await fetchLocalPlaylists();

      // Clear the selected file input
      setSelectedFile(null);

      // Load the newly uploaded playlist
      setIsModalOpen(false);
      fetchPlaylist(data.url);
      setPlaylistUrl(`Local: ${data.name}`);
    } catch (err) {
      addToast(`Upload failed: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteLocalPlaylist = async (name) => {
    try {
      const res = await fetch(`/api/playlists?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast(`Deleted ${name} from server`, "success");
        fetchLocalPlaylists();
      } else {
        const data = await res.json();
        addToast(`Delete failed: ${data.error}`, "error");
      }
    } catch (err) {
      addToast("Failed to delete file", "error");
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchLocalPlaylists();
    }
  }, [isModalOpen]);

  // Keep a ref in sync so the filtered memo can read latest status values
  // without depending on the streamStatus state object — this breaks the
  // feedback loop: streamStatus → filtered → paginated → stream-check effect
  // → setStreamStatus → (repeat forever).
  useEffect(() => { streamStatusRef.current = streamStatus; }, [streamStatus]);

  const countriesList = useMemo(() => {
    const list = new Set<string>();
    channels.forEach(c => {
      if (c.country && c.country.trim()) list.add(c.country.trim().toLowerCase());
    });
    return Array.from(list).sort();
  }, [channels]);

  const languagesList = useMemo(() => {
    const list = new Set<string>();
    channels.forEach(c => {
      if (c.language && c.language.trim()) list.add(c.language.trim().toLowerCase());
    });
    return Array.from(list).sort();
  }, [channels]);

  // Deferred query keeps the search box responsive while filtering a large
  // (10k+ merged) channel list — React renders the input immediately and
  // recomputes `filtered` against the lagging value at lower priority.
  const deferredQuery = useDeferredValue(searchQuery);

  const filtered = useMemo(() => {
    // Merge the hand-pinned World Cup channels in at the top, deduped by URL so
    // a playlist that also carries them doesn't double-list.
    const pinnedUrls = new Set(WORLD_CUP_PINS.map(c => c.url));
    let r = [...WORLD_CUP_PINS, ...channels.filter(c => !pinnedUrls.has(c.url))];
    if (showWorldCup) r = r.filter(isWorldCupChannel);
    if (currentCategory) r = r.filter(c => c.group.split(";").map(g => g.trim()).includes(currentCategory));
    if (selectedCountry) r = r.filter(c => (c.country || "").toLowerCase() === selectedCountry);
    if (selectedLanguage) r = r.filter(c => (c.language || "").toLowerCase() === selectedLanguage);
    if (deferredQuery) {
      const q = deferredQuery.toLowerCase().trim();
      r = r.filter(c => {
        const name = c.name.toLowerCase();
        const group = c.group.toLowerCase();
        const country = (c.country || "").toLowerCase();
        // Searching "world cup"/"fifa" mirrors the World Cup toggle exactly.
        if (q === "world cup" || q === "worldcup" || q === "wc" || q === "fifa") {
          return isWorldCupChannel(c);
        }
        return name.includes(q) || group.includes(q) || country.includes(q);
      });
    }
    if (showOnlyActive) {
      // Read from ref — intentionally NOT in dep array to avoid the cycle.
      const status = streamStatusRef.current;
      r = r.filter(c => (status[c.url] !== "offline" && !c.isGeoBlocked) || (activeChannel && activeChannel.url === c.url));
    }
    return r;
  }, [channels, currentCategory, selectedCountry, selectedLanguage, deferredQuery, showWorldCup, showOnlyActive, activeChannel]);

  const categories = useMemo(() => {
    const counts = {};
    channels.forEach(c => c.group.split(";").forEach(g => {
      const k = g.trim() || "Undefined"; counts[k] = (counts[k] || 0) + 1;
    }));
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name === "Undefined" ? 1 : b.name === "Undefined" ? -1 : a.name.localeCompare(b.name));
  }, [channels]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  /* Stream status — lazy background check for visible channels only.
     Uses checkedRef to prevent re-checking, and updates via ref to avoid
     the streamStatus→filtered→paginated→effect infinite loop. */
  useEffect(() => {
    paginated.forEach(ch => {
      if (checkedRef.current.has(ch.url)) return;
      checkedRef.current.add(ch.url);
      // Mark as checking immediately via ref (no re-render cascade)
      streamStatusRef.current = { ...streamStatusRef.current, [ch.url]: "checking" };
      checkStreamStatus(ch.url).then(s => {
        setStreamStatus(prev => {
          const next = { ...prev, [ch.url]: s };
          streamStatusRef.current = next;
          return next;
        });
      });
    });
  }, [paginated]);


  /* Infinite scroll */
  useEffect(() => {
    if (paginated.length >= filtered.length) return;
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) setPage(p => p + 1); }, {
      root: document.getElementById("ch-scroll"), rootMargin: "150px"
    });
    const el = loaderRef.current;
    if (el) obs.observe(el);
    return () => { if (el) obs.unobserve(el); };
  }, [paginated, filtered]);


  /* App keyboard — Escape closes open modals/drawers (media keys live in usePlayer) */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Escape") { setIsModalOpen(false); setIsBrowseOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const toggleFav = (ch) => {
    const isFav = favorites.includes(ch.url);
    const updated = isFav ? favorites.filter(u => u !== ch.url) : [...favorites, ch.url];
    setFavorites(updated); localStorage.setItem("iptv_favorites", JSON.stringify(updated));
    addToast(isFav ? `Removed ${ch.name} from Favorites` : `Added ${ch.name} to Favorites`, isFav ? "info" : "success");
  };
  const copyUrl = () => {
    if (!activeChannel) return;
    navigator.clipboard.writeText(activeChannel.url).then(() => addToast("URL copied!", "success")).catch(() => addToast("Copy failed", "error"));
  };
  const playChannel = (ch) => {
    setActiveChannel(ch);
    setIsSidebarOpen(false); // close drawer on mobile when channel selected
    setRecents(prev => {
      const next = [ch, ...prev.filter(c => c.url !== ch.url)].slice(0, 10);
      localStorage.setItem("iptv_recents", JSON.stringify(next));
      return next;
    });
  };

  /* Channel Card */
  const ChannelCard = ({ channel, idx }) => {
    const isFav = favorites.includes(channel.url);
    const isActive = activeChannel?.url === channel.url;
    const status = streamStatus[channel.url];
    return (
      <div
        key={channel.url + idx}
        onClick={() => playChannel(channel)}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-200 select-none group
          ${isActive
            ? "bg-violet-500/10 border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.1)]"
            : "bg-slate-800/40 border-white/5 hover:bg-slate-700/50 hover:border-white/10 hover:translate-x-1"
          }
          ${status === "offline" ? "opacity-50 hover:opacity-80" : ""}`}
      >
        {/* Active bar */}
        {isActive && <div className="absolute left-0 top-[20%] bottom-[20%] w-0.5 rounded-r bg-gradient-to-b from-violet-500 to-cyan-500" />}

        {/* Logo */}
        <div className="relative flex-shrink-0 w-10 h-10 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center overflow-visible">
          <ChannelLogo src={channel.logo} alt={channel.name} className="max-w-full max-h-full object-contain rounded-md" />
          {status && <span className={`status-dot ${status}`} />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100 truncate">
            {channel.name}
            {isActive && isPlaying && (
              <span className="inline-flex items-end gap-[2px] w-3.5 h-3 ml-1 flex-shrink-0">
                <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-slate-400 truncate max-w-[110px]">{channel.group}</span>
            {channel.country && <span className="text-[11px]">{flagEmoji(channel.country)}</span>}
            {channel.isGeoBlocked && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-400">GEO</span>}
          </div>
        </div>

        {/* Fav */}
        <button
          onClick={e => { e.stopPropagation(); toggleFav(channel); }}
          className={`p-1.5 rounded-full transition-all flex-shrink-0
            ${isFav ? "text-red-400 opacity-100" : "text-slate-500 opacity-0 group-hover:opacity-100"}
            hover:text-red-400 hover:bg-red-400/10`}
        >
          <Heart className="w-3.5 h-3.5" strokeWidth={isFav ? 0 : 2} fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>
    );
  };

  /* ==========================================================================
     Render
     ========================================================================== */
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#080c14] text-slate-100"
      style={{ backgroundImage: "radial-gradient(at 0% 0%, rgba(139,92,246,0.08) 0,transparent 50%), radial-gradient(at 100% 100%, rgba(6,182,212,0.08) 0,transparent 50%)" }}>

      {/* ── Header ── */}
      <header className="app-header flex-shrink-0 flex items-center justify-between min-h-[60px] sm:min-h-[68px] px-3 sm:px-6 border-b border-white/[0.06] glass bg-[rgba(11,17,30,0.85)] z-50 gap-2">
        {/* Left: hamburger (mobile) + logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsSidebarOpen(v => !v)}
            className="flex sm:hidden items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.07] transition-all"
            aria-label="Toggle channel list"
          >
            <Menu className="w-5 h-5" />
          </button>
          <a href="https://3s-soft.com" target="_blank" rel="noopener noreferrer"
            className="relative flex items-center gap-2 cursor-pointer" title="Designed & developed by 3S-Soft">
            <div className="logo-glow" />
            <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-violet-500 drop-shadow-[0_2px_8px_rgba(139,92,246,0.5)]" />
            <span className="font-['Outfit'] text-base sm:text-lg font-extrabold tracking-wider leading-none">
              3S-<span className="text-gradient">IPTV</span>
              <span className="hidden sm:block text-[8px] font-semibold tracking-normal text-slate-500 mt-0.5">by 3S-Soft</span>
            </span>
          </a>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/8 border border-cyan-500/20 text-[11px] font-bold uppercase tracking-widest text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 relative pulse-dot" />
            iptv-org
          </div>
        </div>

        {/* Search — full bar on desktop, expandable on mobile */}
        <div className={`${
          isMobileSearchOpen ? "flex flex-1" : "hidden sm:flex flex-1"
        } max-w-md mx-0 sm:mx-8 transition-all`}>
          <div className="relative flex items-center w-full">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              id="channel-search"
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search channels…"
              autoComplete="off"
              autoFocus={isMobileSearchOpen}
              className="w-full h-10 bg-white/[0.04] border border-white/[0.07] rounded-xl pl-10 pr-10 text-sm text-slate-200 placeholder:text-slate-500
                focus:outline-none focus:bg-white/[0.08] focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-all"
            />
            {(searchQuery || isMobileSearchOpen) && (
              <button onClick={() => { setSearchQuery(""); setPage(1); setIsMobileSearchOpen(false); }}
                className="absolute right-3 text-slate-400 hover:text-slate-200 p-0.5 rounded-full hover:bg-white/10 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          {/* Mobile search toggle */}
          {!isMobileSearchOpen && (
            <button
              onClick={() => setIsMobileSearchOpen(true)}
              className="flex sm:hidden items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.07] transition-all"
              aria-label="Search"
            >
              <Search className="w-4.5 h-4.5" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm font-medium text-slate-400">
            <span className="relative w-2 h-2 flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 block" />
              <span className="absolute inset-0 rounded-full bg-emerald-400 pulse-dot" />
            </span>
            {isPlaylistLoading
              ? (multiLoadProgress ? `${multiLoadProgress.done}/${multiLoadProgress.total}` : "Loading…")
              : `${channels.length.toLocaleString()} Ch`}
          </div>
          <button onClick={handleSyncSources} disabled={isPlaylistLoading}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/[0.07] bg-transparent text-slate-400 hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-slate-200 transition-all disabled:opacity-50 flex-shrink-0"
            title="Sync/Refresh playlists and update cache"
          >
            <RefreshCw className={`w-4 h-4 ${isPlaylistLoading ? "animate-spin text-violet-400" : ""}`} />
          </button>
          <button onClick={() => setIsBrowseOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl border border-white/[0.07] bg-transparent text-slate-400 text-xs sm:text-sm font-semibold
              hover:bg-white/[0.06] hover:border-white/[0.12] hover:text-slate-200 transition-all">
            <Tag className="w-4 h-4" /><span className="hidden sm:inline">Browse</span>
          </button>
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl border border-white/[0.07] bg-white/[0.04] text-slate-300 text-xs sm:text-sm font-semibold
              hover:bg-white/[0.09] hover:border-white/[0.14] transition-all">
            <Settings className="w-4 h-4" /><span className="hidden sm:inline">Playlist</span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* Mobile sidebar backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm sm:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside className={`
          flex flex-col border-r border-white/[0.06] glass bg-[rgba(15,23,42,0.95)] overflow-hidden z-30
          fixed sm:relative inset-y-0 left-0
          w-[320px] sm:w-[360px] min-w-0 sm:min-w-[360px]
          transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
          top-[60px] sm:top-0 h-[calc(100%-60px)] sm:h-full
        `}>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-3 pt-3 gap-1">
            {[
              { id: "channels",   icon: <List className="w-4 h-4" />,   label: "Channels"   },
              { id: "categories", icon: <Folder className="w-4 h-4" />, label: "Categories" },
              { id: "favorites",  icon: <Heart className="w-4 h-4" />,  label: "Favorites"  },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-1.5 pb-3 pt-2 text-[11px] font-semibold rounded-t-md transition-all border-b-2
                  ${activeTab === t.id
                    ? "text-violet-400 border-violet-500 bg-violet-500/[0.04]"
                    : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.02]"}`}>
                {t.icon}{t.label}
              </button>
            ))}
            {/* Mobile-only close button */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="flex sm:hidden items-center justify-center w-9 h-9 mb-0.5 self-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all flex-shrink-0"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Channels Panel */}
          {activeTab === "channels" && (
            <div className="flex flex-col flex-1 min-h-0">
              {currentCategory && (
                <div className="flex items-center justify-between px-4 py-2 bg-violet-500/[0.08] border-b border-violet-500/15 text-xs font-semibold text-violet-300 animate-[fadeUp_0.25s_ease]">
                  <span className="flex items-center gap-1.5">
                    <CategoryIcon name={currentCategory} className="w-3.5 h-3.5" /> {currentCategory}
                  </span>
                  <button onClick={() => { setCurrentCategory(null); setPage(1); }}
                    className="p-0.5 rounded hover:bg-violet-500/20 text-violet-300 transition-all"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {/* Filter bar */}
              <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/[0.04] bg-slate-900/40 text-slate-400 text-[11px] select-none">
                <span className="font-semibold uppercase tracking-wider text-slate-500 truncate">
                  {showWorldCup ? "World Cup" : currentCategory ? "Filtered Channels" : "All Channels"}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => { setShowWorldCup(!showWorldCup); setPage(1); }}
                    title="Show only World Cup / FIFA channels"
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-all
                      ${showWorldCup
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.08)]"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    <Trophy className="w-3 h-3" />
                    World Cup
                  </button>
                  <button
                    onClick={() => { setShowOnlyActive(!showOnlyActive); setPage(1); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-all
                      ${showOnlyActive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.05)]"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${showOnlyActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                    Show Only Active
                  </button>
                </div>
              </div>

              {/* Country & Language Quick Selects */}
              <div className="flex gap-2 px-4 py-1.5 border-b border-white/[0.04] bg-slate-900/20 select-none">
                <select
                  value={selectedCountry}
                  onChange={(e) => { setSelectedCountry(e.target.value); setPage(1); }}
                  className="flex-1 h-7 bg-[#0b0f19] border border-white/[0.07] rounded-md px-1 text-[10px] font-semibold text-slate-300 focus:outline-none focus:border-violet-500 transition-all cursor-pointer"
                >
                  <option value="" className="bg-[#0b0f19] text-slate-300">🌍 All Countries</option>
                  {countriesList.map(c => (
                    <option key={c} value={c} className="bg-[#0b0f19] text-slate-300">
                      {flagEmoji(c)} {c.toUpperCase()}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedLanguage}
                  onChange={(e) => { setSelectedLanguage(e.target.value); setPage(1); }}
                  className="flex-1 h-7 bg-[#0b0f19] border border-white/[0.07] rounded-md px-1 text-[10px] font-semibold text-slate-300 focus:outline-none focus:border-violet-500 transition-all cursor-pointer"
                >
                  <option value="" className="bg-[#0b0f19] text-slate-300">🌐 All Languages</option>
                  {languagesList.map(l => (
                    <option key={l} value={l} className="bg-[#0b0f19] text-slate-300">
                      💬 {l.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Liveness Scanner Control */}
              <div className="px-4 py-2 border-b border-white/[0.04] bg-slate-900/20 flex flex-col gap-2">
                {scanState.isScanning ? (
                  <div className="flex flex-col gap-1.5 text-[11px] animate-[fadeIn_0.2s_ease]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-semibold flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                        Checking liveness ({scanState.checkedCount}/{scanState.totalCount})
                      </span>
                      <button
                        onClick={cancelLivenessScan}
                        className="text-red-400 hover:text-red-300 font-bold hover:underline transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/[0.03]">
                      <div
                        className="bg-gradient-to-r from-violet-500 to-cyan-500 h-full transition-all duration-300"
                        style={{ width: `${(scanState.checkedCount / scanState.totalCount) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {scanState.onlineCount} Active
                      </span>
                      <span className="text-red-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        {scanState.offlineCount} Offline
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-slate-400">
                    <span className="font-semibold flex items-center gap-1">
                      <Zap className="w-3 h-3 text-violet-400" /> Scan Liveness:
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startLivenessScan(filtered)}
                        disabled={filtered.length === 0}
                        className="flex-1 sm:flex-none px-2 py-0.5 rounded bg-violet-600/80 hover:bg-violet-600 disabled:opacity-50 text-white font-semibold transition-all shadow-[0_2px_6px_rgba(139,92,246,0.15)] text-center text-[10px]"
                        title="Scan channels matching current search/filters"
                      >
                        Scan Filtered ({filtered.length})
                      </button>
                      <button
                        onClick={() => startLivenessScan(channels)}
                        disabled={channels.length === 0}
                        className="flex-1 sm:flex-none px-2 py-0.5 rounded border border-white/10 hover:bg-white/5 hover:border-white/20 disabled:opacity-50 text-slate-300 font-medium transition-all text-center text-[10px]"
                        title="Scan all channels in the playlist"
                      >
                        Scan All ({channels.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Tags / Trending Searches */}
              <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-white/[0.03] bg-slate-900/20 overflow-x-auto scrollbar-none text-[10px] select-none">
                <span className="text-slate-500 font-semibold uppercase flex-shrink-0 mr-1">Trending:</span>
                {[
                  { label: "World Cup 🏆", query: "world cup" },
                  { label: "Cricket 🏏", query: "icc" },
                  { label: "Sports ⚽", query: "sports" },
                  { label: "News 📰", query: "news" },
                  { label: "Movies 🎬", query: "movie" }
                ].map(t => (
                  <button
                    key={t.label}
                    onClick={() => {
                      const nextQuery = searchQuery.toLowerCase().trim() === t.query ? "" : t.query;
                      setSearchQuery(nextQuery);
                      setPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-full border transition-all flex-shrink-0 font-medium
                      ${searchQuery.toLowerCase().trim() === t.query
                        ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                        : "bg-white/[0.02] border-white/[0.05] text-slate-400 hover:border-white/10 hover:text-slate-200"
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div id="ch-scroll" className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {isPlaylistLoading ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-violet-500 rounded-full animate-spin" />
                    <p className="text-sm">Loading IPTV streams…</p>
                  </div>
                ) : paginated.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-500">
                    <Search className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No channels found</p>
                  </div>
                ) : (
                  <>
                    {paginated.map((ch, i) => <ChannelCard key={ch.url + i} channel={ch} idx={i} />)}
                    {paginated.length < filtered.length && <div ref={loaderRef} className="h-5 w-full" />}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Categories Panel */}
          {activeTab === "categories" && (
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {categories.map((cat, i) => (
                <button key={cat.name + i} onClick={() => { setCurrentCategory(cat.name); setActiveTab("channels"); setPage(1); }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all hover:-translate-y-px
                    ${currentCategory === cat.name
                      ? "bg-violet-500/10 border-violet-500/40"
                      : "bg-slate-800/40 border-white/5 hover:bg-slate-700/50 hover:border-white/10"}`}>
                  <div className="flex items-center gap-3">
                    <CategoryIcon name={cat.name} className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-200">{cat.name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 bg-white/5 border border-white/[0.06] px-2 py-1 rounded-md">{cat.count.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {/* Favorites Panel */}
          {activeTab === "favorites" && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Filter bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-slate-900/40 text-slate-400 text-[11px] select-none">
                <span className="font-semibold uppercase tracking-wider text-slate-500">
                  Your Favorites
                </span>
                <button
                  onClick={() => { setShowOnlyActive(!showOnlyActive); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-all
                    ${showOnlyActive
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.05)]"
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] text-slate-400 hover:text-slate-200"
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${showOnlyActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                  Show Only Active
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {favorites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500">
                    <Heart className="w-12 h-12 opacity-20" />
                    <p className="text-sm font-semibold">No favorites yet</p>
                    <span className="text-xs text-center max-w-[180px] opacity-70">Click the heart icon on any channel to save it here.</span>
                  </div>
                ) : (
                  channels
                    .filter(c => favorites.includes(c.url))
                    .filter(c => !showOnlyActive || (streamStatus[c.url] !== "offline" && !c.isGeoBlocked) || (activeChannel && activeChannel.url === c.url))
                    .map((ch, i) => <ChannelCard key={ch.url + "fav" + i} channel={ch} idx={i} />)
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden p-3 sm:p-5 gap-3 sm:gap-4"
          style={{ background: "radial-gradient(circle at top right, rgba(139,92,246,0.05) 0%, transparent 60%)" }}>

          {/* Player */}
          <VideoPlayer
            player={player}
            activeChannel={activeChannel}
            onRetry={() => { if (activeChannel) playChannel(activeChannel); }}
            idle={
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090e18]">
                <div className="flex flex-col items-center gap-4 text-center px-6 animate-[zoomIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">
                  <div className="relative">
                    <div className="absolute inset-0 w-16 h-16 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-full blur-2xl opacity-30" />
                    <Tv2 className="w-16 h-16 text-violet-500 relative z-10 animate-[pulseIcon_2s_ease-in-out_infinite]" />
                  </div>
                  <h3 className="font-['Outfit'] text-xl font-bold text-slate-100">Ready to Stream</h3>
                  <p className="text-sm text-slate-400">Select a channel from the sidebar or browse below.</p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                    {IPTV_ORG_CATEGORIES.slice(0, 6).map(cat => (
                      <button key={cat.name} onClick={() => { fetchPlaylist(cat.url); setActivePresetUrl(cat.url); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[12px] font-semibold text-slate-300
                          hover:bg-violet-500/15 hover:border-violet-500/40 hover:text-slate-100 transition-all">
                        <CategoryIcon name={cat.name} className="w-3 h-3 text-violet-400" /> {cat.name}
                      </button>
                    ))}
                  </div>
                  {filtered.length > 0 && (
                    <button onClick={() => playChannel(filtered[0])}
                      className="flex items-center gap-2 h-11 px-6 rounded-xl bg-accent-gradient text-white text-sm font-bold shadow-[0_4px_12px_rgba(139,92,246,0.3)]
                        hover:shadow-[0_6px_20px_rgba(139,92,246,0.5)] hover:-translate-y-px transition-all">
                      <Play className="w-4 h-4" /> Play First Channel
                    </button>
                  )}
                  <p className="mt-3 text-[11px] text-slate-500">
                    Designed &amp; developed by{" "}
                    <a href="https://3s-soft.com" target="_blank" rel="noopener noreferrer"
                      className="font-bold text-gradient hover:underline">3S-Soft</a>
                  </p>
                </div>
              </div>
            }
          />

          {/* Channel Details */}
          {activeChannel && (
            <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-5 py-3 sm:py-4 bg-slate-800/40 border border-white/[0.06] rounded-xl sm:rounded-2xl animate-[fadeUp_0.4s_ease]">
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                <div className="w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0 rounded-xl bg-black/30 border border-white/[0.08] flex items-center justify-center overflow-hidden">
                  <ChannelLogo src={activeChannel.logo} alt={activeChannel.name} className="max-w-[80%] max-h-[80%] object-contain" />
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 truncate max-w-[120px]">{activeChannel.group}</span>
                    {activeChannel.country && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">{flagEmoji(activeChannel.country)} {activeChannel.country.toUpperCase()}</span>}
                    {activeChannel.isGeoBlocked && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">Geo</span>}
                  </div>
                  <h2 className="font-['Outfit'] text-base sm:text-lg font-bold text-slate-100 truncate">{activeChannel.name}</h2>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate max-w-[180px] sm:max-w-xs" title={activeChannel.url}>{activeChannel.url.split("/")[2]}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => toggleFav(activeChannel)}
                  className={`flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl text-xs font-bold border transition-all
                    ${favorites.includes(activeChannel.url) ? "bg-red-500/10 border-red-500/25 text-red-400" : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:border-white/[0.12] hover:text-slate-200"}`}>
                  <Heart className="w-3.5 h-3.5" fill={favorites.includes(activeChannel.url) ? "currentColor" : "none"} />
                  <span className="hidden xs:inline">{favorites.includes(activeChannel.url) ? "Favorited" : "Favorite"}</span>
                </button>
                <button onClick={copyUrl}
                  className="flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl text-xs font-bold bg-white/[0.03] border border-white/[0.07] text-slate-400 hover:border-white/[0.12] hover:text-slate-200 transition-all">
                  <Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Copy URL</span>
                </button>
                <a href={activeChannel.url.replace(/^https?:\/\//, "vlc://")}
                  className="flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl text-xs font-bold bg-cyan-500/[0.05] border border-cyan-500/15 text-cyan-400 hover:bg-cyan-500/12 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" /> VLC
                </a>
              </div>
            </div>
          )}

          {/* Recently Played */}
          <section className="flex-shrink-0">
            <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-white/[0.06]">
              <History className="w-5 h-5 text-violet-400" />
              <h3 className="font-['Outfit'] text-base font-semibold">Recently Played</h3>
            </div>
            {recents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-white/[0.01] border border-dashed border-white/[0.06] rounded-xl">
                No recently viewed channels. Select a stream to start watching.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 sm:gap-3">
                {recents.map((ch, i) => <ChannelCard key={ch.url + "recent" + i} channel={ch} idx={i} />)}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* ── Browse Panel ── */}
      {isBrowseOpen && (
        <BrowsePanel
          onClose={() => setIsBrowseOpen(false)}
          fetchPlaylist={fetchPlaylist}
          activePresetUrl={activePresetUrl}
          setActivePresetUrl={setActivePresetUrl}
        />
      )}

      {/* ── Playlist Modal ── */}
      <PlaylistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        modalTab={modalTab}
        setModalTab={setModalTab}
        customUrlInput={customUrlInput}
        setCustomUrlInput={setCustomUrlInput}
        activePresetUrl={activePresetUrl}
        setActivePresetUrl={setActivePresetUrl}
        loadAllSources={loadAllSources}
        setLoadAllSources={setLoadAllSources}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        localPlaylists={localPlaylists}
        isUploading={isUploading}
        isPlaylistLoading={isPlaylistLoading}
        fileInputRef={fileInputRef}
        setPlaylistUrl={setPlaylistUrl}
        fetchPlaylist={fetchPlaylist}
        fetchMultiplePlaylists={fetchMultiplePlaylists}
        uploadAndLoadFile={uploadAndLoadFile}
        deleteLocalPlaylist={deleteLocalPlaylist}
        handleFileUpload={handleFileUpload}
        addToast={addToast}
      />

      {/* ── Toast Notifications ── */}
      <div className="fixed right-5 z-[9999] flex flex-col gap-2 pointer-events-none bottom-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium animate-[fadeUp_0.25s_ease] pointer-events-auto
            ${t.type === "success" ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
            : t.type === "error"   ? "bg-red-500/15 border-red-500/25 text-red-300"
            : "bg-slate-700/80 border-white/10 text-slate-300"}`}>
            {t.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
             : t.type === "error" ? <AlertOctagon className="w-4 h-4 flex-shrink-0" />
             : <HelpCircle className="w-4 h-4 flex-shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
