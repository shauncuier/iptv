"use client";

import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import Hls from "hls.js";
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
import { parseM3U, isWorldCupChannel } from "./lib/m3u";
import { getCachedPlaylist, setCachedPlaylist } from "./lib/cache";
import { checkStreamStatus, flagEmoji } from "./lib/stream";
import { DEFAULT_PLAYLIST, IPTV_ORG_CATEGORIES, IPTV_ORG_LANGUAGES, IPTV_ORG_COUNTRIES } from "./lib/constants";
import type { Channel } from "./lib/types";

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

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);

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
  const [streamStatus, setStreamStatus] = useState({});
  const streamStatusRef = useRef({});

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const mpegtsRef = useRef(null);
  const mpegtsModuleRef = useRef(null);
  const playerContainerRef = useRef(null);
  const touchRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const checkedRef = useRef(new Set());
  const loaderRef = useRef(null);
  const fileInputRef = useRef(null);

  const [aspectRatio, setAspectRatio] = useState("contain");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    resolution: "N/A",
    bitrate: "N/A",
    buffer: "0",
    droppedFrames: 0,
  });
  const [hlsLevels, setHlsLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [dataSaver, setDataSaver] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("iptv_datasaver") === "1");
  const [brightness, setBrightness] = useState(1);
  const [gestureHint, setGestureHint] = useState(null); // { type, value }
  const [castAvailable, setCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [airplayAvailable, setAirplayAvailable] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [localPlaylists, setLocalPlaylists] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const saveToCache = async (chList, url) => {
    await setCachedPlaylist("channels", chList);
    await setCachedPlaylist("playlistUrl", url);
    await setCachedPlaylist("cacheTimestamp", Date.now());
  };

  const handleSyncSources = () => {
    if (IPTV_SOURCES && IPTV_SOURCES.length) {
      fetchMultiplePlaylists(IPTV_SOURCES);
    } else {
      fetchPlaylist(DEFAULT_PLAYLIST);
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
      cancelLivenessScan();
    }
  }, [channels, currentCategory]);

  /* Init */
  useEffect(() => {
    try {
      const f = localStorage.getItem("iptv_favorites");
      if (f) setFavorites(JSON.parse(f));
      const r = localStorage.getItem("iptv_recents");
      if (r) setRecents(JSON.parse(r));
    } catch {}

    // Dynamically load client-side only mpegts.js library
    if (typeof window !== "undefined") {
      import("mpegts.js").then((mod) => {
        mpegtsModuleRef.current = mod.default || mod;
      }).catch(err => console.error("Failed to load mpegts.js:", err));
    }

    // Load from cache first for instant startup!
    (async () => {
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
        if (IPTV_SOURCES && IPTV_SOURCES.length) fetchMultiplePlaylists(IPTV_SOURCES);
        else fetchPlaylist(DEFAULT_PLAYLIST);
      }
    })();
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

  // Merge many M3U sources at once. Fetches each through the same proxy as
  // fetchPlaylist, runs them in a small concurrency batch, and dedupes by
  // stream URL so overlapping sources (e.g. several iptv-org variants) don't
  // double-list channels. One dead URL is reported and skipped, not fatal.
  const fetchMultiplePlaylists = async (sources) => {
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

  const fetchLocalPlaylists = async () => {
    try {
      const res = await fetch("/api/playlists");
      if (res.ok) {
        const data = await res.json();
        setLocalPlaylists(data.playlists || []);
      }
    } catch (err) {
      console.error("Failed to load local playlists:", err);
    }
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
    let r = [...channels];
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
        if (q === "world cup" || q === "worldcup" || q === "wc" || q === "fifa") {
          return name.includes("world cup") || name.includes("worldcup") || name.includes("fifa") || name.includes("icc") || name.includes("t20") || name.includes("sports 18") || group.includes("sports");
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

  /* HLS Player */
  useEffect(() => {
    if (!activeChannel) return;
    setHlsLevels([]);
    setCurrentLevel(-1);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (mpegtsRef.current) { mpegtsRef.current.destroy(); mpegtsRef.current = null; }
    const video = videoRef.current;
    if (!video) return;
    video.pause(); video.src = ""; video.load();
    setIsPlaying(false); setPlaybackError(null); setIsLoadingStream(true);
    const url = activeChannel.url;

    // Guard against a stale async chain — if the user picks a different channel
    // while the pre-flight probe or load is in flight, abandon this one.
    let cancelled = false;
    let started = false;     // true once real playback begins
    let netRetries = 0;      // cap NETWORK_ERROR recovery attempts
    let timeout;             // the hard ceiling (set after pre-flight passes)

    const cleanup = () => {
      cancelled = true;
      clearTimeout(timeout);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (mpegtsRef.current) { mpegtsRef.current.destroy(); mpegtsRef.current = null; }
    };

    const failStream = (msg) => {
      if (started || cancelled) return;   // already playing or superseded
      cleanup();
      video.pause(); video.src = ""; video.load();
      setStreamStatus(p => ({ ...p, [url]: "offline" }));
      setPlaybackError(msg);
      setIsLoadingStream(false); setIsPlaying(false);
    };

    const onPlaying = () => {
      started = true; clearTimeout(timeout);
      setIsLoadingStream(false); setIsPlaying(true);
      setStreamStatus(p => ({ ...p, [url]: "online" }));
    };

    // Hard ceiling: if playback hasn't actually started in 20s after the
    // manifest began loading, give up. Guard on `started`, NOT video.paused —
    // play() flips paused=false while still buffering, which made the old
    // check never fire. (Raised from 12s to 20s to allow slow CDNs room.)
    const startHardTimeout = () => {
      timeout = setTimeout(() => {
        failStream("Timed out waiting for the first video frame (20s). The manifest loaded but media segments could not be buffered — the CDN serving this stream may be geo-blocked or overloaded from this server's region.");
      }, 20000);
    };

    const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

    const beginPlayback = () => {
      if (cancelled) return;
      startHardTimeout();

      const isMpegTS = url.toLowerCase().split('?')[0].endsWith(".ts");
      const mpegts = mpegtsModuleRef.current;

      if (isMpegTS && mpegts && mpegts.isSupported()) {
        try {
          // Absolute URL: with enableWorker the IO loader runs in a Web Worker
          // whose base is a blob: origin, so a relative "/api/proxy?..." would
          // resolve against the blob and throw NetworkError/Exception.
          const mpegtsUrl = new URL(proxiedUrl, window.location.origin).toString();
          const mpegtsPlayer = mpegts.createPlayer({
            type: 'mpegts',
            url: mpegtsUrl,
            isLive: true
          }, {
            enableWorker: true,
            enableStashBuffer: false,
            liveBufferLatencyChaser: true,
          });
          mpegtsRef.current = mpegtsPlayer;
          mpegtsPlayer.attachMediaElement(video);
          mpegtsPlayer.load();
          mpegtsPlayer.play().catch(() => {});

          let mpegtsRetries = 0;
          mpegtsPlayer.on(mpegts.Events.ERROR, (type, detail, info) => {
            if (cancelled || started) return;
            // Recover a couple of times on transient network errors, then give
            // up — mirrors the HLS NETWORK_ERROR retry path above.
            if (type === mpegts.ErrorTypes.NETWORK_ERROR && mpegtsRetries < 2) {
              mpegtsRetries++;
              try {
                mpegtsPlayer.unload();
                mpegtsPlayer.load();
                mpegtsPlayer.play().catch(() => {});
              } catch {}
              return;
            }
            console.error("mpegts error:", type, detail, info);
            failStream("Failed to load MPEG-TS stream in browser. The stream may be offline, geo-blocked, or incompatible.");
          });

          video.addEventListener("loadedmetadata", () => {
            if (!cancelled) {
              setHlsLevels([]);
              setCurrentLevel(-1);
            }
          });
        } catch (e) {
          console.error("mpegts init failed:", e);
          failStream("Failed to initialize MPEG-TS player in browser.");
        }
      } else if (Hls.isSupported()) {
        const hls = new Hls({
          // Data Saver: tiny buffer + start on lowest rendition. Smaller buffer
          // also means fewer megabytes pulled before a channel switch is abandoned.
          maxMaxBufferLength: dataSaver ? 8 : 20,
          maxBufferLength: dataSaver ? 5 : 30,
          startLevel: dataSaver ? 0 : -1,
          enableWorker: true,
          lowLatencyMode: true,
          // Short per-request timeouts so a silently-dropping (geo-blocked) host
          // surfaces a fatal error fast instead of hanging the loader.
          manifestLoadingTimeOut: 8000,
          manifestLoadingMaxRetry: 1,
          levelLoadingTimeOut: 8000,
          levelLoadingMaxRetry: 1,
          fragLoadingTimeOut: 8000,
          fragLoadingMaxRetry: 1,
        });
        hlsRef.current = hls;
        hls.loadSource(proxiedUrl); hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          if (cancelled) return;
          // Data Saver: cap auto-ABR to the lowest rendition (levels are sorted
          // ascending by bitrate, so index 0 is the smallest).
          hls.autoLevelCapping = dataSaver ? 0 : -1;
          setHlsLevels(hls.levels || []);
          setCurrentLevel(hls.currentLevel);
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          if (cancelled) return;
          setCurrentLevel(hls.currentLevel);
        });
        hls.on(Hls.Events.ERROR, (_, d) => {
          if (!d.fatal || cancelled) return;
          const isKeyError = d.details === Hls.ErrorDetails.KEY_LOAD_ERROR ||
                             d.details === Hls.ErrorDetails.KEY_LOAD_TIMEOUT;
          if (isKeyError) {
            failStream("Stream uses AES-128 encryption and its key server blocked the request. Try another channel or open in VLC.");
          } else if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Recover a couple of times, then give up — don't loop forever.
            if (netRetries < 2) { netRetries++; hls.startLoad(); }
            else failStream("Could not connect to stream server. It may be offline or geo-blocked.");
          } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            failStream("Could not connect to stream server. It may be offline or geo-blocked.");
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = proxiedUrl;
        video.addEventListener("loadedmetadata", () => { if (!cancelled) video.play().catch(() => {}); });
        video.addEventListener("error", () => { failStream("Native HLS failed. The stream may be offline or geo-blocked."); });
      } else {
        clearTimeout(timeout); setPlaybackError("HLS not supported. Use Chrome or Edge."); setIsLoadingStream(false);
      }
      video.addEventListener("playing", onPlaying);
    };

    // Channels in the list are pre-verified at playlist load time by
    // verifyChannels(), so no redundant pre-flight probe needed here.
    // Go straight to playback — HLS.js error handlers catch dead segments fast.
    beginPlayback();

    return () => { cleanup(); video.removeEventListener("playing", onPlaying); };
  }, [activeChannel, dataSaver]);

  /* Stats for Nerds and Advanced Control Handlers */
  const handleQualityChange = (levelIndex) => {
    if (hlsRef.current) {
      // Manual quality pick overrides Data Saver's cap.
      if (dataSaver && levelIndex !== 0) {
        hlsRef.current.autoLevelCapping = -1;
        setDataSaver(false);
        localStorage.setItem("iptv_datasaver", "0");
      }
      hlsRef.current.currentLevel = levelIndex;
      setCurrentLevel(levelIndex);
    }
  };

  const toggleDataSaver = () => {
    setDataSaver(prev => {
      const next = !prev;
      localStorage.setItem("iptv_datasaver", next ? "1" : "0");
      addToast(next ? "Data Saver on — lowest quality, less buffering" : "Data Saver off", "info");
      return next;
    });
  };

  const toggleAspectRatio = () => {
    setAspectRatio(prev => {
      if (prev === "contain") return "cover";
      if (prev === "cover") return "fill";
      return "contain";
    });
  };

  useEffect(() => {
    if (!isPlaying || !showStats || !videoRef.current) return;
    const interval = setInterval(() => {
      const v = videoRef.current;
      const hls = hlsRef.current;
      if (!v) return;

      // Calculate buffer length
      let bufferLen = 0;
      if (v.buffered && v.buffered.length > 0) {
        for (let i = 0; i < v.buffered.length; i++) {
          if (v.currentTime >= v.buffered.start(i) && v.currentTime <= v.buffered.end(i)) {
            bufferLen = v.buffered.end(i) - v.currentTime;
            break;
          }
        }
      }

      // Bitrate and resolution
      let resolution = v.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : "N/A";
      let bitrate = "N/A";

      if (hls && hls.levels && hls.currentLevel !== undefined && hls.levels[hls.currentLevel]) {
        const lvl = hls.levels[hls.currentLevel];
        bitrate = `${(lvl.bitrate / 1000000).toFixed(2)} Mbps`;
        if (!v.videoWidth && lvl.width) resolution = `${lvl.width}x${lvl.height}`;
      }

      // Dropped frames
      let dropped = 0;
      if (v.getVideoPlaybackQuality) {
        dropped = v.getVideoPlaybackQuality().droppedVideoFrames;
      }

      setStats({
        resolution,
        bitrate,
        buffer: bufferLen.toFixed(1),
        droppedFrames: dropped,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, showStats, activeChannel]);

  /* Buffering indicator — track stalls after playback has started */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeChannel) return;
    setIsBuffering(false);
    const onStall = () => setIsBuffering(true);
    const onResume = () => setIsBuffering(false);
    v.addEventListener("waiting", onStall);
    v.addEventListener("stalled", onStall);
    v.addEventListener("playing", onResume);
    v.addEventListener("canplay", onResume);
    return () => {
      v.removeEventListener("waiting", onStall);
      v.removeEventListener("stalled", onStall);
      v.removeEventListener("playing", onResume);
      v.removeEventListener("canplay", onResume);
    };
  }, [activeChannel]);

  /* AirPlay availability (Safari only) */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || typeof window === "undefined" || !window.WebKitPlaybackTargetAvailabilityEvent) return;
    const handler = (e) => setAirplayAvailable(e.availability === "available");
    v.addEventListener("webkitplaybacktargetavailabilitychanged", handler);
    return () => v.removeEventListener("webkitplaybacktargetavailabilitychanged", handler);
  }, [activeChannel]);

  /* Google Cast SDK — load once, wire CastContext when ready */
  useEffect(() => {
    if (typeof window === "undefined" || document.getElementById("cast-sdk")) return;
    const initCast = () => {
      try {
        const ctx = window.cast.framework.CastContext.getInstance();
        ctx.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        const sync = () => {
          const state = ctx.getCastState();
          setCastAvailable(state !== "NO_DEVICES_AVAILABLE");
          setIsCasting(state === "CONNECTED");
        };
        ctx.addEventListener(window.cast.framework.CastContextEventType.CAST_STATE_CHANGED, sync);
        sync();
      } catch {}
    };
    window.__onGCastApiAvailable = (available) => { if (available) initCast(); };
    const s = document.createElement("script");
    s.id = "cast-sdk";
    s.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  /* Keyboard shortcuts — space play/pause, f fullscreen, m mute, ↑↓ volume */
  useEffect(() => {
    const h = (e) => {
      const isInput = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if (e.code === "Escape") { setIsModalOpen(false); setIsBrowseOpen(false); return; }
      if (isInput) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
      else if (e.key === "m" || e.key === "M") { e.preventDefault(); toggleMute(); }
      else if (e.code === "ArrowUp") { e.preventDefault(); nudgeVolume(0.05); }
      else if (e.code === "ArrowDown") { e.preventDefault(); nudgeVolume(-0.05); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isPlaying, activeChannel, isMuted, volume]);

  // Step volume and sync the media element + mute state (shared by ↑↓ keys).
  const nudgeVolume = (delta) => {
    const nv = Math.min(1, Math.max(0, volume + delta));
    setVolume(nv); setIsMuted(nv === 0);
    if (videoRef.current) { videoRef.current.volume = nv; videoRef.current.muted = nv === 0; }
    setGestureHint({ type: "volume", value: Math.round(nv * 100) });
    setTimeout(() => setGestureHint(null), 600);
  };

  // Keep the media element's volume/mute in sync with React state — covers the
  // initial channel load (video defaults to 1.0, ignoring the 0.8 state) and
  // any external change. Runs whenever a stream (re)attaches.
  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.volume = volume; v.muted = isMuted; }
  }, [volume, isMuted, activeChannel, isLoadingStream]);

  // Auto-hide player controls after inactivity; reveal on pointer/touch move.
  // Fixes mobile, where the old hover-only CSS left controls unreachable.
  const revealControls = () => {
    setControlsVisible(true);
    clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3500);
    }
  };
  useEffect(() => {
    revealControls();
    return () => clearTimeout(controlsTimerRef.current);
  }, [isPlaying, activeChannel]);

  /* Controls */
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || !activeChannel) return;
    if (isPlaying) { v.pause(); setIsPlaying(false); }
    else v.play().then(() => setIsPlaying(true)).catch(() => addToast("Cannot resume stream", "error"));
  };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !isMuted; setIsMuted(!isMuted); };
  const handleVolume = (e) => {
    const val = parseFloat(e.target.value); setVolume(val); setIsMuted(val === 0);
    if (videoRef.current) { videoRef.current.volume = val; videoRef.current.muted = val === 0; }
  };
  const toggleFullscreen = () => {
    const c = playerContainerRef.current; if (!c) return;
    if (!document.fullscreenElement) c.requestFullscreen().catch(() => addToast("Fullscreen denied", "error"));
    else document.exitFullscreen();
  };
  const togglePip = async () => {
    const v = videoRef.current; if (!v) return;
    try { document.pictureInPictureElement ? await document.exitPictureInPicture() : v.readyState >= 1 ? await v.requestPictureInPicture() : addToast("Wait for stream to load", "info"); }
    catch {}
  };
  const showAirPlay = () => {
    try { videoRef.current?.webkitShowPlaybackTargetPicker(); }
    catch { addToast("AirPlay unavailable", "error"); }
  };
  const toggleCast = async () => {
    if (!activeChannel || typeof window === "undefined" || !window.cast) {
      addToast("No cast device found", "info"); return;
    }
    try {
      const ctx = window.cast.framework.CastContext.getInstance();
      if (ctx.getCastState() === "CONNECTED") { ctx.endCurrentSession(true); setIsCasting(false); return; }
      await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) return;
      // Cast device fetches the stream directly from its own IP — send the raw
      // upstream URL, not the same-origin proxy (which the TV cannot reach).
      const mediaInfo = new window.chrome.cast.media.MediaInfo(activeChannel.url, "application/x-mpegURL");
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = activeChannel.name;
      if (activeChannel.logo) mediaInfo.metadata.images = [new window.chrome.cast.Image(activeChannel.logo)];
      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);
      setIsCasting(true);
      addToast(`Casting ${activeChannel.name}`, "success");
    } catch { addToast("Cast failed", "error"); }
  };

  /* Mobile gestures — vertical swipe: right half = volume, left half = brightness */
  const onTouchStart = (e) => {
    if (e.touches.length !== 1 || !playerContainerRef.current) return;
    const t = e.touches[0];
    const rect = playerContainerRef.current.getBoundingClientRect();
    touchRef.current = {
      y: t.clientY,
      side: (t.clientX - rect.left) < rect.width / 2 ? "left" : "right",
      h: rect.height,
      startVol: volume,
      startBright: brightness,
      moved: false,
    };
  };
  const onTouchMove = (e) => {
    const ref = touchRef.current;
    if (!ref || e.touches.length !== 1) return;
    const dy = ref.y - e.touches[0].clientY; // up = positive
    if (Math.abs(dy) < 8) return;
    ref.moved = true;
    const frac = dy / ref.h;
    if (ref.side === "right") {
      const nv = Math.min(1, Math.max(0, ref.startVol + frac));
      setVolume(nv); setIsMuted(nv === 0);
      if (videoRef.current) { videoRef.current.volume = nv; videoRef.current.muted = nv === 0; }
      setGestureHint({ type: "volume", value: Math.round(nv * 100) });
    } else {
      const nb = Math.min(1.8, Math.max(0.3, ref.startBright + frac));
      setBrightness(nb);
      setGestureHint({ type: "brightness", value: Math.round(nb * 100) });
    }
  };
  const onTouchEnd = () => {
    // A tap (no significant move) toggles the controls overlay on touch devices.
    if (touchRef.current && !touchRef.current.moved) {
      setControlsVisible(v => !v);
      clearTimeout(controlsTimerRef.current);
      if (isPlaying) controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3500);
    }
    touchRef.current = null;
    setTimeout(() => setGestureHint(null), 600);
  };
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
  const addToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080c14] text-slate-100"
      style={{ backgroundImage: "radial-gradient(at 0% 0%, rgba(139,92,246,0.08) 0,transparent 50%), radial-gradient(at 100% 100%, rgba(6,182,212,0.08) 0,transparent 50%)" }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between h-[60px] sm:h-[68px] px-3 sm:px-6 border-b border-white/[0.06] glass bg-[rgba(11,17,30,0.85)] z-50 gap-2">
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
          <div className="relative flex items-center gap-2 cursor-pointer">
            <div className="logo-glow" />
            <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-violet-500 drop-shadow-[0_2px_8px_rgba(139,92,246,0.5)]" />
            <span className="font-['Outfit'] text-base sm:text-lg font-extrabold tracking-wider">
              3S-<span className="text-gradient">IPTV</span>
            </span>
          </div>
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
          <div ref={playerContainerRef}
            className={`player-container relative w-full flex-shrink-0 bg-black rounded-xl sm:rounded-2xl overflow-hidden border border-white/[0.06] shadow-[0_16px_48px_rgba(0,0,0,0.6)] ${controlsVisible ? "controls-visible" : ""}`}
            style={{ aspectRatio: "16/9", maxHeight: "calc(100svh - 60px - 180px)" }}
            onMouseMove={revealControls}
            onMouseLeave={() => isPlaying && setControlsVisible(false)}
            onDoubleClick={toggleFullscreen}>

            {/* Video */}
            <video
              ref={videoRef}
              playsInline
              x-webkit-airplay="allow"
              className="player-video"
              style={{ objectFit: aspectRatio as React.CSSProperties["objectFit"], filter: brightness !== 1 ? `brightness(${brightness})` : undefined }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            />

            {/* Stats for Nerds HUD */}
            {showStats && activeChannel && isPlaying && (
              <div className="absolute top-3 left-3 z-30 bg-slate-950/85 backdrop-blur-md border border-white/10 rounded-xl p-3 text-[10px] font-mono text-slate-300 flex flex-col gap-1 shadow-2xl max-w-[220px] pointer-events-none select-none animate-[fadeIn_0.2s_ease]">
                <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1">
                  <span className="font-semibold text-violet-400 uppercase tracking-wider text-[9px]">Stats for Nerds</span>
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold uppercase tracking-wider">Active</span>
                </div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">Resolution:</span> <span className="font-bold text-slate-200">{stats.resolution}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">Bitrate:</span> <span className="font-bold text-slate-200">{stats.bitrate}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">Buffer Length:</span> <span className="font-bold text-slate-200">{stats.buffer}s</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">Dropped Frames:</span> <span className="font-bold text-slate-200">{stats.droppedFrames}</span></div>
                <div className="flex justify-between truncate gap-2"><span className="text-slate-500 font-medium">Host:</span> <span className="font-bold text-slate-200 truncate">{activeChannel.url.split("/")[2]}</span></div>
              </div>
            )}

            {/* Overlay: idle */}
            {!activeChannel && (
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
                </div>
              </div>
            )}

            {/* Overlay: loading */}
            {activeChannel && isLoadingStream && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090e18]">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-violet-500/20 border-t-violet-500 border-r-cyan-500 animate-spin" />
                  <h3 className="font-['Outfit'] text-lg font-bold">Connecting to Stream</h3>
                  <p className="text-sm font-semibold text-slate-300">{activeChannel.name}</p>
                  <p className="text-xs text-slate-500">Initializing HLS playback…</p>
                </div>
              </div>
            )}

            {/* Overlay: buffering (mid-playback stall) */}
            {activeChannel && isPlaying && isBuffering && !isLoadingStream && !playbackError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 pointer-events-none animate-[fadeIn_0.15s_ease]">
                <Loader2 className="w-12 h-12 text-violet-400 animate-spin drop-shadow-[0_0_10px_rgba(139,92,246,0.4)]" />
              </div>
            )}

            {/* Overlay: gesture hint (volume / brightness) */}
            {gestureHint && (
              <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/10 shadow-2xl">
                  {gestureHint.type === "volume"
                    ? (gestureHint.value === 0 ? <VolumeX className="w-6 h-6 text-violet-400" /> : <Volume2 className="w-6 h-6 text-violet-400" />)
                    : <Sun className="w-6 h-6 text-amber-400" />}
                  <div className="w-28 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${gestureHint.type === "volume" ? "bg-violet-500" : "bg-amber-400"}`}
                      style={{ width: `${gestureHint.type === "brightness" ? (gestureHint.value / 1.8) : gestureHint.value}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white tabular-nums w-9 text-right">{gestureHint.value}%</span>
                </div>
              </div>
            )}

            {/* Overlay: error */}
            {activeChannel && playbackError && (() => {
              const err = playbackError.toLowerCase();
              const isTimeout  = err.includes("timed out") || err.includes("segments");
              const isGeoBlock = err.includes("403") || err.includes("451") || err.includes("forbidden") || err.includes("geo-blocked");
              const isGone     = err.includes("404");
              const isAuth     = err.includes("401") || err.includes("authentication") || err.includes("key server");
              const isServer   = err.includes("500") || err.includes("502") || err.includes("503") || err.includes("server error");

              const why = isTimeout
                ? "The manifest URL responded OK, but media segments are served by a different CDN that this server cannot reach. Verification only probes the manifest — segment delivery is a separate hop that can still be geo-throttled or blocked."
                : isGeoBlock
                ? "The broadcaster is explicitly blocking requests from this server's IP or country (HTTP 403/451). This is a server-side geo-restriction, not a browser CORS issue. Opening in VLC will play it directly from your IP instead."
                : isGone
                ? "The stream URL returned HTTP 404 — the broadcaster has removed or relocated this channel. It may have been taken down permanently."
                : isAuth
                ? "This stream requires a session token, API key, or DRM licence that this app cannot supply. It is likely a premium subscription channel."
                : isServer
                ? "The broadcaster's streaming server returned a 5xx error — it may be temporarily down or overloaded. Wait a few minutes and retry."
                : "The stream host is not responding. It may be offline, have moved, or be blocking requests from this server's region.";

              return (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090e18] p-6">
                  <div className="flex flex-col items-center gap-4 text-center max-w-md animate-[zoomIn_0.3s_ease]">
                    <AlertTriangle className="w-14 h-14 text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                    <h3 className="font-['Outfit'] text-xl font-bold">Unable to Play Channel</h3>
                    <p className="text-sm text-slate-400">{playbackError}</p>
                    <div className="w-full p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/15 text-left">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5 flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Why?</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{why}</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => playChannel(activeChannel)}
                        className="flex items-center gap-2 h-10 px-5 rounded-xl bg-accent-gradient text-white text-sm font-bold hover:-translate-y-px transition-all">
                        <RefreshCw className="w-4 h-4" /> Retry
                      </button>
                      <a href={activeChannel.url.replace(/^https?:\/\//, "vlc://")}
                        className="flex items-center gap-2 h-10 px-5 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/20 text-cyan-400 text-sm font-bold hover:bg-cyan-500/15 transition-all">
                        <PlayCircle className="w-4 h-4" /> Open in VLC
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Player Controls */}
            {activeChannel && !playbackError && (
              <div className="player-controls">
                {/* Progress row */}
                <div className="flex items-center gap-3">
                  <div className="live-badge">
                    <div className="live-dot" />
                    LIVE
                  </div>
                  <div className="flex-1 h-1 bg-white/20 rounded-full relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" />
                  </div>
                </div>
                {/* Controls row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={togglePlay} className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-all">
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <div className="volume-group flex items-center gap-1">
                      <button onClick={toggleMute} className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-all">
                        {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : volume < 0.5 ? <Volume1 className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <input type="range" className="volume-slider" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolume} />
                    </div>
                    <span className="ml-2 text-sm font-semibold text-white truncate max-w-[240px]">{activeChannel.name}</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Data Saver toggle */}
                    <button
                      onClick={toggleDataSaver}
                      title={dataSaver ? "Data Saver ON — lowest quality" : "Data Saver OFF"}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/15 transition-all ${dataSaver ? "text-emerald-400 bg-emerald-500/10" : "text-white"}`}
                    >
                      <Zap className="w-4.5 h-4.5" />
                    </button>

                    {/* Aspect Ratio selector */}
                    <button
                      onClick={toggleAspectRatio}
                      title={`Aspect Ratio: ${aspectRatio === "contain" ? "Fit" : aspectRatio === "cover" ? "Zoom" : "Stretch"}`}
                      className="h-9 px-2 text-[10px] font-extrabold tracking-wider uppercase rounded-lg text-slate-300 hover:text-white hover:bg-white/15 transition-all"
                    >
                      {aspectRatio === "contain" ? "Fit" : aspectRatio === "cover" ? "Zoom" : "Stretch"}
                    </button>

                    {/* HLS quality selector */}
                    {hlsLevels.length > 0 && (
                      <div className="relative group">
                        <button className="h-9 px-2 flex items-center gap-1 text-[10px] font-extrabold tracking-wider rounded-lg text-slate-300 hover:text-white hover:bg-white/15 transition-all">
                          <Settings className="w-3.5 h-3.5 animate-[spin_8s_linear_infinite]" />
                          {currentLevel === -1 ? "Auto" : `${hlsLevels[currentLevel]?.height || "N/A"}p`}
                        </button>
                        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block bg-slate-950/95 border border-white/10 rounded-xl p-1 min-w-[85px] z-50 text-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-md">
                          <button
                            onClick={() => handleQualityChange(-1)}
                            className={`w-full text-left px-2 py-1.5 rounded-lg transition-all font-semibold ${currentLevel === -1 ? "text-violet-400 bg-violet-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                          >
                            Auto
                          </button>
                          {hlsLevels.map((lvl, index) => (
                            <button
                              key={index}
                              onClick={() => handleQualityChange(index)}
                              className={`w-full text-left px-2 py-1.5 rounded-lg transition-all font-semibold ${currentLevel === index ? "text-violet-400 bg-violet-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
                            >
                              {lvl.height ? `${lvl.height}p` : `${(lvl.bitrate / 1000).toFixed(0)}k`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stats for nerds toggle */}
                    <button
                      onClick={() => setShowStats(!showStats)}
                      title="Stats for Nerds"
                      className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/15 transition-all ${showStats ? "text-violet-400 bg-violet-500/10" : "text-white"}`}
                    >
                      <Activity className="w-4.5 h-4.5" />
                    </button>

                    {castAvailable && (
                      <button onClick={toggleCast} className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/15 transition-all ${isCasting ? "text-violet-400 bg-violet-500/10" : "text-white"}`} title="Cast to TV">
                        <Cast className="w-5 h-5" />
                      </button>
                    )}
                    {airplayAvailable && (
                      <button onClick={showAirPlay} className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-all" title="AirPlay">
                        <Airplay className="w-5 h-5" />
                      </button>
                    )}
                    <button onClick={togglePip} className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-all" title="Picture in Picture">
                      <PictureInPicture2 className="w-5 h-5" />
                    </button>
                    <button onClick={toggleFullscreen} className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-all" title="Fullscreen">
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

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
        <div className="fixed inset-0 z-[200] flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setIsBrowseOpen(false)}>
          <div className="browse-panel w-[500px] max-w-[90vw] h-full flex flex-col glass bg-[rgba(11,17,30,0.98)] border-l border-white/[0.07]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
              <h3 className="flex items-center gap-2.5 font-['Outfit'] text-base font-bold">
                <Tag className="w-4 h-4 text-violet-400" /> Quick Browse
              </h3>
              <button onClick={() => setIsBrowseOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-7">
              {[
                { label: "Categories", icon: <Film className="w-3.5 h-3.5 text-violet-400" />, items: IPTV_ORG_CATEGORIES, renderChip: (c) => (
                  <button key={c.url} onClick={() => { setIsBrowseOpen(false); fetchPlaylist(c.url); setActivePresetUrl(c.url); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:-translate-y-px whitespace-nowrap
                      ${activePresetUrl === c.url ? "bg-violet-500/20 border-violet-500 text-violet-300" : "bg-white/[0.04] border-white/[0.07] text-slate-400 hover:bg-violet-500/10 hover:border-violet-500/40 hover:text-slate-200"}`}>
                    <CategoryIcon name={c.name} className="w-3 h-3" />{c.name}
                    <em className="not-italic opacity-40 text-[10px]">{c.count.toLocaleString()}</em>
                  </button>
                )},
                { label: "Languages", icon: <Languages className="w-3.5 h-3.5 text-violet-400" />, items: IPTV_ORG_LANGUAGES, renderChip: (l) => (
                  <button key={l.url} onClick={() => { setIsBrowseOpen(false); fetchPlaylist(l.url); setActivePresetUrl(l.url); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:-translate-y-px whitespace-nowrap
                      ${activePresetUrl === l.url ? "bg-violet-500/20 border-violet-500 text-violet-300" : "bg-white/[0.04] border-white/[0.07] text-slate-400 hover:bg-violet-500/10 hover:border-violet-500/40 hover:text-slate-200"}`}>
                    <Globe className="w-3 h-3" />{l.name}
                  </button>
                )},
                { label: "Countries", icon: <MapPin className="w-3.5 h-3.5 text-violet-400" />, items: IPTV_ORG_COUNTRIES, renderChip: (c) => (
                  <button key={c.url} onClick={() => { setIsBrowseOpen(false); fetchPlaylist(c.url); setActivePresetUrl(c.url); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:-translate-y-px whitespace-nowrap
                      ${activePresetUrl === c.url ? "bg-violet-500/20 border-violet-500 text-violet-300" : "bg-white/[0.04] border-white/[0.07] text-slate-400 hover:bg-violet-500/10 hover:border-violet-500/40 hover:text-slate-200"}`}>
                    <span className="text-sm">{flagEmoji(c.code)}</span>{c.name}
                  </button>
                )},
              ].map(section => (
                <div key={section.label}>
                  <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                    {section.icon}{section.label}
                  </h4>
                  <div className="flex flex-wrap gap-2">{section.items.map(section.renderChip)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Playlist Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(3,7,18,0.75)] backdrop-blur-lg">
          <div className="w-full max-w-xl bg-[#0d131f] border border-white/10 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_30px_rgba(139,92,246,0.15)] overflow-hidden animate-[fadeUp_0.25s_ease]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
              <h3 className="flex items-center gap-2.5 font-['Outfit'] text-lg font-bold">
                <Settings className="w-5 h-5 text-violet-400" /> IPTV Playlist Manager
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"><X className="w-5 h-5" /></button>
            </div>

            {/* Modal tabs */}
            <div className="flex gap-1.5 p-1.5 mx-6 mt-5 bg-black/25 rounded-xl border border-white/[0.06] overflow-x-auto scrollbar-none whitespace-nowrap">
              {[
                { id: "sources",  icon: <Tv className="w-3.5 h-3.5" />, label: "All Sources" },
                { id: "category", icon: <Tag className="w-3.5 h-3.5" />, label: "Category" },
                { id: "language", icon: <Languages className="w-3.5 h-3.5" />, label: "Language" },
                { id: "country",  icon: <MapPin className="w-3.5 h-3.5" />, label: "Country" },
                { id: "url",      icon: <LinkIcon className="w-3.5 h-3.5" />, label: "Custom URL" },
                { id: "file",     icon: <UploadCloud className="w-3.5 h-3.5" />, label: "Upload" },
              ].map(t => (
                <button key={t.id} onClick={() => setModalTab(t.id)}
                  className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all
                    ${modalTab === t.id ? "bg-violet-500/15 text-violet-300 border border-violet-500/30" : "text-slate-500 hover:text-slate-300"}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div className="px-6 py-4 max-h-[380px] overflow-y-auto">
              {modalTab === "sources" && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-slate-500">Select any single stream source or load all configured playlists combined.</p>
                  
                  {/* Load All Sources combined & Upload Local File */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        const allSources = [
                          ...IPTV_SOURCES,
                          ...localPlaylists.map(pl => ({ name: pl.name, url: pl.url }))
                        ];
                        fetchMultiplePlaylists(allSources);
                      }}
                      className="flex-1 flex items-center gap-3 p-3.5 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/15 to-cyan-500/10 hover:from-violet-500/20 hover:to-cyan-500/15 hover:border-violet-500/50 shadow-md transition-all text-left hover:-translate-y-px"
                    >
                      <Zap className="w-5 h-5 text-violet-400 flex-shrink-0 animate-[pulseIcon_1.5s_infinite]" />
                      <div>
                        <p className="text-xs font-bold text-slate-100">⚡ Combine All Sources</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Merge all {IPTV_SOURCES.length + localPlaylists.length} sources together</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setModalTab("file");
                        setTimeout(() => fileInputRef.current?.click(), 100);
                      }}
                      className="flex-1 flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-violet-500/5 hover:border-violet-500/20 shadow-md transition-all text-left hover:-translate-y-px"
                    >
                      <UploadCloud className="w-5 h-5 text-violet-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-100">📂 Upload M3U File</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Upload a local playlist file to server</p>
                      </div>
                    </button>
                  </div>

                  {/* Individual Sources List */}
                  <div className="flex flex-col gap-2 mt-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Individual Playlists</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Config Sources */}
                      {IPTV_SOURCES.map(src => (
                        <button
                          key={src.url}
                          onClick={() => {
                            setIsModalOpen(false);
                            fetchPlaylist(src.url);
                            setPlaylistUrl(src.name);
                          }}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-violet-500/5 hover:border-violet-500/20 transition-all text-left group"
                        >
                          <Tv className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">{src.name}</p>
                            <p className="text-[10px] text-slate-500 truncate" title={src.url}>{src.url.split("/")[2] || "Config Source"}</p>
                          </div>
                        </button>
                      ))}

                      {/* Uploaded Local Playlists */}
                      {localPlaylists.map(pl => (
                        <button
                          key={pl.url}
                          onClick={() => {
                            setIsModalOpen(false);
                            fetchPlaylist(pl.url);
                            setPlaylistUrl(`Local: ${pl.name}`);
                          }}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-violet-500/10 bg-violet-500/[0.02] hover:bg-violet-500/10 hover:border-violet-500/30 transition-all text-left group"
                        >
                          <FileText className="w-4 h-4 text-violet-400 group-hover:text-violet-300 transition-colors flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">{pl.name}</p>
                            <p className="text-[10px] text-violet-400 font-medium truncate">Uploaded File ({(pl.size / 1024).toFixed(0)} KB)</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "category" && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-slate-500">Browse channels from <strong className="text-slate-300">iptv-org</strong> grouped by category.</p>
                  {/* All configured sources — merge everything from sources.config.mjs */}
                  {IPTV_SOURCES && IPTV_SOURCES.length > 0 && (
                    <button onClick={() => setLoadAllSources(v => !v)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left w-full
                        ${loadAllSources ? "bg-gradient-to-r from-violet-500/20 to-cyan-500/15 border-violet-500/50" : "bg-gradient-to-r from-violet-500/8 to-cyan-500/5 border-violet-500/25 hover:border-violet-500/40"}`}>
                      <Zap className="w-5 h-5 text-violet-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-100">⚡ All Configured Sources ({IPTV_SOURCES.length})</p>
                        <p className="text-xs text-slate-500 mt-0.5">Merge every source from <code className="bg-white/5 px-1 rounded">sources.config.mjs</code> into one list</p>
                      </div>
                    </button>
                  )}
                  {/* All categories card */}
                  <button onClick={() => { setActivePresetUrl(DEFAULT_PLAYLIST); setLoadAllSources(false); }}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left w-full
                      ${!loadAllSources && activePresetUrl === DEFAULT_PLAYLIST ? "bg-violet-500/15 border-violet-500/50" : "bg-white/[0.03] border-white/[0.07] hover:bg-violet-500/8 hover:border-violet-500/25"}`}>
                    <Zap className="w-5 h-5 text-violet-400 flex-shrink-0" />
                    <div><p className="text-sm font-semibold text-slate-200">All Categories (index.category.m3u)</p><p className="text-xs text-slate-500 mt-0.5">Complete iptv-org playlist — 8,000+ channels</p></div>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {IPTV_ORG_CATEGORIES.map(cat => (
                      <button key={cat.url} onClick={() => { setActivePresetUrl(cat.url); setLoadAllSources(false); }}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left
                          ${!loadAllSources && activePresetUrl === cat.url ? "bg-violet-500/15 border-violet-500/50" : "bg-white/[0.03] border-white/[0.07] hover:bg-violet-500/8 hover:border-violet-500/25 hover:-translate-y-px"}`}>
                        <CategoryIcon name={cat.name} className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        <div><p className="text-xs font-semibold text-slate-200">{cat.name}</p><p className="text-[11px] text-slate-500">{cat.count.toLocaleString()} ch</p></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modalTab === "language" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500 mb-1">Browse by broadcast language.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {IPTV_ORG_LANGUAGES.map(lang => (
                      <button key={lang.url} onClick={() => setActivePresetUrl(lang.url)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left
                          ${activePresetUrl === lang.url ? "bg-violet-500/15 border-violet-500/50" : "bg-white/[0.03] border-white/[0.07] hover:bg-violet-500/8 hover:border-violet-500/25 hover:-translate-y-px"}`}>
                        <Globe className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        <p className="text-xs font-semibold text-slate-200">{lang.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modalTab === "country" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500 mb-1">Browse by country of origin.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {IPTV_ORG_COUNTRIES.map(c => (
                      <button key={c.url} onClick={() => setActivePresetUrl(c.url)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left
                          ${activePresetUrl === c.url ? "bg-violet-500/15 border-violet-500/50" : "bg-white/[0.03] border-white/[0.07] hover:bg-violet-500/8 hover:border-violet-500/25 hover:-translate-y-px"}`}>
                        <span className="text-lg flex-shrink-0">{flagEmoji(c.code)}</span>
                        <p className="text-xs font-semibold text-slate-200">{c.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modalTab === "url" && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-slate-500">Enter any public <code className="bg-white/5 px-1 rounded">.m3u</code> playlist URL.</p>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="m3u-url-input" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Playlist URL</label>
                    <input id="m3u-url-input" type="url" value={customUrlInput} onChange={e => { setCustomUrlInput(e.target.value); setActivePresetUrl(e.target.value); }}
                      placeholder="https://example.com/playlist.m3u"
                      className="h-11 bg-black/25 border border-white/[0.08] rounded-xl px-4 text-sm text-slate-200 placeholder:text-slate-600
                        focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-all" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Quick Presets</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ["All Categories", DEFAULT_PLAYLIST],
                        ["Full Index", "https://iptv-org.github.io/iptv/index.m3u"],
                        ["Lupael IPTV", "https://lupael.github.io/IPTV/running.m3u"],
                        ["Mrgify BDIX", "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/playlist.m3u"],
                        ["By Language", "https://iptv-org.github.io/iptv/index.language.m3u"],
                        ["By Country",  "https://iptv-org.github.io/iptv/index.country.m3u"],
                      ].map(([label, url]) => (
                        <button key={url} onClick={() => { setCustomUrlInput(url); setActivePresetUrl(url); }}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
                            ${activePresetUrl === url ? "bg-violet-500/15 border-violet-500/40 text-violet-300" : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:border-violet-500/30 hover:text-slate-200"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "file" && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-slate-500">Upload M3U playlists to save them on the server or browse saved playlists.</p>
                  <div onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) setSelectedFile(e.dataTransfer.files[0]); }}
                    className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-all">
                    <Upload className="w-8 h-8 text-slate-600" />
                    <p className="text-xs text-slate-400">Drag & drop your <strong className="text-slate-300">.m3u</strong> file</p>
                    <span className="text-[10px] text-slate-600">or click to browse</span>
                    <input ref={fileInputRef} type="file" accept=".m3u,.m3u8" className="hidden" onChange={e => { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }} />
                  </div>
                  
                  {selectedFile && (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-slate-300 truncate flex-1">{selectedFile.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={isUploading}
                          onClick={() => uploadAndLoadFile(selectedFile)}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold transition-all"
                        >
                          {isUploading ? "Uploading..." : "Upload & Save"}
                        </button>
                        <button
                          disabled={isUploading}
                          onClick={() => setSelectedFile(null)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload library stored on server */}
                  <div className="flex flex-col gap-2 mt-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saved Playlists on Server</p>
                    {localPlaylists.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No playlists saved on server yet.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {localPlaylists.map(pl => (
                          <div key={pl.name} className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] transition-all">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-200 truncate">{pl.name}</p>
                                <p className="text-[10px] text-slate-500">{(pl.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-3">
                              <button
                                onClick={() => {
                                  setIsModalOpen(false);
                                  fetchPlaylist(pl.url);
                                  setPlaylistUrl(`Local: ${pl.name}`);
                                }}
                                className="px-2.5 py-1 rounded bg-violet-600/80 hover:bg-violet-600 text-white text-[10px] font-bold transition-all"
                              >
                                Load
                              </button>
                              <button
                                onClick={() => deleteLocalPlaylist(pl.name)}
                                className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                title="Delete from server"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
              <button onClick={() => setIsModalOpen(false)}
                className="h-10 px-5 rounded-xl text-sm font-semibold border border-white/[0.07] text-slate-400 hover:border-white/[0.12] hover:text-slate-200 transition-all">
                Cancel
              </button>
              <button disabled={isPlaylistLoading}
                onClick={() => {
                  if (modalTab === "file") {
                    if (!selectedFile) return addToast("Select an M3U file first", "error");
                    setIsModalOpen(false); handleFileUpload(selectedFile);
                  } else if (modalTab === "category" && loadAllSources && IPTV_SOURCES.length) {
                    setIsModalOpen(false); fetchMultiplePlaylists(IPTV_SOURCES);
                  } else {
                    if (!activePresetUrl) return addToast("Select or enter a playlist URL", "error");
                    setIsModalOpen(false); fetchPlaylist(activePresetUrl);
                  }
                }}
                className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold bg-accent-gradient text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.5)] hover:-translate-y-px transition-all disabled:opacity-60 disabled:pointer-events-none">
                {isPlaylistLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isPlaylistLoading ? "Loading…" : "Load Playlist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ── */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
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
