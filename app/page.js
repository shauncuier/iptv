"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Hls from "hls.js";
import {
  Tv,
  Search,
  X,
  Settings,
  List,
  Folder,
  Heart,
  Film,
  Newspaper,
  Trophy,
  Music,
  Smile,
  Church,
  CloudSun,
  ShoppingBag,
  GraduationCap,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  PictureInPicture2,
  Maximize,
  AlertTriangle,
  RefreshCw,
  PlayCircle,
  Globe,
  History,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  UploadCloud,
  Upload,
  FileText,
  Trash2,
  CheckCircle,
  AlertOctagon,
  HelpCircle,
  Tv2
} from "lucide-react";

// Fallback channel image constant
const FALLBACK_LOGO = "https://images.unsplash.com/photo-1598257006458-087169a1f08d?w=120&auto=format&fit=crop&q=60";

/* ==========================================================================
   Background Utilities & Fetchers
   ========================================================================== */

// Background stream connection tester
async function checkStreamStatus(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout
    
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return "online";
  } catch (e) {
    return "offline";
  }
}

// Robust M3U Parser
function parseM3U(text) {
  const channels = [];
  const lines = text.split(/\r?\n/);
  let currentMetadata = null;
  const attrRegex = /([a-zA-Z0-9_-]+)=(?:"([^"]*)"|([^ ]*))/g;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith("#EXTINF:")) {
      const commaIndex = line.lastIndexOf(",");
      if (commaIndex === -1) continue;
      
      const metaPart = line.substring(0, commaIndex);
      const namePart = line.substring(commaIndex + 1);
      
      const attrs = {};
      let match;
      attrRegex.lastIndex = 0;
      while ((match = attrRegex.exec(metaPart)) !== null) {
        const key = match[1].toLowerCase();
        const val = match[2] || match[3] || "";
        attrs[key] = val;
      }
      
      const name = namePart.trim();
      attrs["tvg-logo"] = attrs["tvg-logo"] || "";
      attrs["group-title"] = attrs["group-title"] || "Undefined";
      
      currentMetadata = {
        name,
        logo: attrs["tvg-logo"],
        group: attrs["group-title"],
        tvgId: attrs["tvg-id"] || "",
        isGeoBlocked: name.toLowerCase().includes("geo-blocked"),
        not247: name.toLowerCase().includes("not 24/7") || name.toLowerCase().includes("not 24h")
      };
    } else if (line.startsWith("#")) {
      continue;
    } else if (line.startsWith("http://") || line.startsWith("https://")) {
      if (currentMetadata) {
        channels.push({ ...currentMetadata, url: line });
        currentMetadata = null;
      } else {
        const parts = line.split("/");
        const filename = parts[parts.length - 1] || "Unknown Stream";
        channels.push({
          name: filename.replace(".m3u8", "").replace(".m3u", ""),
          logo: "",
          group: "Undefined",
          tvgId: "",
          url: line,
          isGeoBlocked: false,
          not247: false
        });
      }
    }
  }
  return channels;
}

const PRESET_CATEGORIES = [
  { name: "Animation", url: "https://iptv-org.github.io/iptv/categories/animation.m3u" },
  { name: "Auto", url: "https://iptv-org.github.io/iptv/categories/auto.m3u" },
  { name: "Business", url: "https://iptv-org.github.io/iptv/categories/business.m3u" },
  { name: "Classic", url: "https://iptv-org.github.io/iptv/categories/classic.m3u" },
  { name: "Comedy", url: "https://iptv-org.github.io/iptv/categories/comedy.m3u" },
  { name: "Cooking", url: "https://iptv-org.github.io/iptv/categories/cooking.m3u" },
  { name: "Culture", url: "https://iptv-org.github.io/iptv/categories/culture.m3u" },
  { name: "Documentary", url: "https://iptv-org.github.io/iptv/categories/documentary.m3u" },
  { name: "Education", url: "https://iptv-org.github.io/iptv/categories/education.m3u" },
  { name: "Entertainment", url: "https://iptv-org.github.io/iptv/categories/entertainment.m3u" },
  { name: "General", url: "https://iptv-org.github.io/iptv/categories/general.m3u" },
  { name: "Kids", url: "https://iptv-org.github.io/iptv/categories/kids.m3u" },
  { name: "Legislative", url: "https://iptv-org.github.io/iptv/categories/legislative.m3u" },
  { name: "Lifestyle", url: "https://iptv-org.github.io/iptv/categories/lifestyle.m3u" },
  { name: "Movies", url: "https://iptv-org.github.io/iptv/categories/movies.m3u" },
  { name: "Music", url: "https://iptv-org.github.io/iptv/categories/music.m3u" },
  { name: "News", url: "https://iptv-org.github.io/iptv/categories/news.m3u" },
  { name: "Outdoor", url: "https://iptv-org.github.io/iptv/categories/outdoor.m3u" },
  { name: "Religious", url: "https://iptv-org.github.io/iptv/categories/religious.m3u" },
  { name: "Science", url: "https://iptv-org.github.io/iptv/categories/science.m3u" },
  { name: "Series", url: "https://iptv-org.github.io/iptv/categories/series.m3u" },
  { name: "Sports", url: "https://iptv-org.github.io/iptv/categories/sports.m3u" },
  { name: "Travel", url: "https://iptv-org.github.io/iptv/categories/travel.m3u" },
  { name: "Weather", url: "https://iptv-org.github.io/iptv/categories/weather.m3u" }
];

const PRESET_LANGUAGES = [
  { name: "English", url: "https://iptv-org.github.io/iptv/languages/eng.m3u" },
  { name: "Arabic", url: "https://iptv-org.github.io/iptv/languages/ara.m3u" },
  { name: "Bengali", url: "https://iptv-org.github.io/iptv/languages/ben.m3u" },
  { name: "Chinese", url: "https://iptv-org.github.io/iptv/languages/zho.m3u" },
  { name: "French", url: "https://iptv-org.github.io/iptv/languages/fra.m3u" },
  { name: "German", url: "https://iptv-org.github.io/iptv/languages/deu.m3u" },
  { name: "Hindi", url: "https://iptv-org.github.io/iptv/languages/hin.m3u" },
  { name: "Italian", url: "https://iptv-org.github.io/iptv/languages/ita.m3u" },
  { name: "Japanese", url: "https://iptv-org.github.io/iptv/languages/jpn.m3u" },
  { name: "Korean", url: "https://iptv-org.github.io/iptv/languages/kor.m3u" },
  { name: "Portuguese", url: "https://iptv-org.github.io/iptv/languages/por.m3u" },
  { name: "Russian", url: "https://iptv-org.github.io/iptv/languages/rus.m3u" },
  { name: "Spanish", url: "https://iptv-org.github.io/iptv/languages/spa.m3u" },
  { name: "Turkish", url: "https://iptv-org.github.io/iptv/languages/tur.m3u" }
];

export default function IPTVPage() {
  /* ==========================================================================
     State Hook Definitions
     ========================================================================== */
  const [channels, setChannels] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [recents, setRecents] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  
  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState("channels-list"); // 'channels-list' | 'categories-list' | 'favorites-list'
  const [currentCategory, setCurrentCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Infinite Scroll Page Control
  const [page, setPage] = useState(1);
  const pageSize = 80;
  
  // Playback Control States
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);
  
  // Playlist Modal Controls
  const [playlistUrl, setPlaylistUrl] = useState("https://lupael.github.io/IPTV/running.m3u");
  const [customUrlInput, setCustomUrlInput] = useState("https://lupael.github.io/IPTV/running.m3u");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSourceTab, setModalSourceTab] = useState("url"); // 'url' | 'file'
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Toast notifications & Stream Status
  const [toasts, setToasts] = useState([]);
  const [streamStatus, setStreamStatus] = useState({}); // { url: 'online' | 'offline' | 'checking' }
  const [activePresetUrl, setActivePresetUrl] = useState("https://lupael.github.io/IPTV/running.m3u");
  const [isPlaylistLoading, setIsPlaylistLoading] = useState(false);
  
  // DOM References
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerContainerRef = useRef(null);
  const checkedUrlsRef = useRef(new Set());
  const observerRef = useRef(null);
  const fileInputRef = useRef(null);

  /* ==========================================================================
     Data Fetching & Storage Syncer
     ========================================================================== */

  // Load favorites & recents on initial mount
  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem("iptv_favorites");
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
      
      const savedRecents = localStorage.getItem("iptv_recents");
      if (savedRecents) setRecents(JSON.parse(savedRecents));
    } catch (e) {
      console.error("Failed loading local storage preferences:", e);
    }
    
    // Auto-fetch default playlist
    fetchPlaylist(playlistUrl);
  }, []);

  // Dynamic browser tab title sync
  useEffect(() => {
    if (activeChannel && isPlaying) {
      document.title = `▶ Playing: ${activeChannel.name} | 3s-IPTV`;
    } else {
      document.title = "3s-IPTV - Premium Live Television Stream Player";
    }
  }, [activeChannel, isPlaying]);

  // Fetch playlist text from server
  const fetchPlaylist = async (url) => {
    setIsPlaylistLoading(true);
    addToast("Loading playlist streams...", "info");
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      const parsed = parseM3U(text);
      
      if (parsed.length === 0) {
        throw new Error("No valid streams found in the M3U playlist.");
      }
      
      // Update channels list
      setChannels(parsed);
      setPlaylistUrl(url);
      setSearchQuery("");
      setCurrentCategory(null);
      setPage(1);
      checkedUrlsRef.current.clear();
      setStreamStatus({});
      
      addToast(`Loaded ${parsed.length.toLocaleString()} channels!`, "success");
    } catch (err) {
      console.error("Error fetching playlist:", err);
      addToast(`Failed loading playlist: ${err.message}`, "error");
    } finally {
      setIsPlaylistLoading(false);
    }
  };

  // Safe file reader
  const handlePlaylistFileUpload = (file) => {
    setIsPlaylistLoading(true);
    addToast(`Reading ${file.name}...`, "info");
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseM3U(text);
        
        if (parsed.length === 0) {
          throw new Error("No valid streams found in the M3U playlist file.");
        }
        
        setChannels(parsed);
        setPlaylistUrl(`Local File: ${file.name}`);
        setSearchQuery("");
        setCurrentCategory(null);
        setPage(1);
        checkedUrlsRef.current.clear();
        setStreamStatus({});
        
        addToast(`Uploaded list containing ${parsed.length} channels!`, "success");
      } catch (err) {
        addToast(`Failed parsing file: ${err.message}`, "error");
      } finally {
        setIsPlaylistLoading(false);
      }
    };
    reader.onerror = () => {
      addToast("Failed to read file from disk", "error");
      setIsPlaylistLoading(false);
    };
    reader.readAsText(file);
  };

  /* ==========================================================================
     State Memoizations
     ========================================================================== */

  // Dynamic filter channels based on categories & searches
  const filteredChannels = useMemo(() => {
    let result = [...channels];
    
    if (currentCategory) {
      result = result.filter(ch => {
        const groups = ch.group.split(";").map(g => g.trim());
        return groups.includes(currentCategory);
      });
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ch => 
        ch.name.toLowerCase().includes(q) || 
        ch.group.toLowerCase().includes(q) || 
        ch.url.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [channels, currentCategory, searchQuery]);

  // Aggregate categories
  const categories = useMemo(() => {
    const counts = {};
    channels.forEach(ch => {
      const groups = ch.group.split(";");
      groups.forEach(g => {
        const clean = g.trim() || "Undefined";
        counts[clean] = (counts[clean] || 0) + 1;
      });
    });
    
    const list = Object.keys(counts).map(name => ({
      name,
      count: counts[name]
    }));
    
    list.sort((a, b) => {
      if (a.name === "Undefined") return 1;
      if (b.name === "Undefined") return -1;
      return a.name.localeCompare(b.name);
    });
    
    return list;
  }, [channels]);

  // Paginated visible channels
  const paginatedChannels = useMemo(() => {
    return filteredChannels.slice(0, page * pageSize);
  }, [filteredChannels, page]);

  /* ==========================================================================
     Lazy Connection Checker
     ========================================================================== */

  // Run status checks only for the currently visible items in the viewport
  useEffect(() => {
    const visibleSubset = paginatedChannels;
    
    visibleSubset.forEach(channel => {
      if (checkedUrlsRef.current.has(channel.url)) return;
      checkedUrlsRef.current.add(channel.url);
      
      setStreamStatus(prev => ({ ...prev, [channel.url]: "checking" }));
      
      checkStreamStatus(channel.url).then(status => {
        setStreamStatus(prev => ({ ...prev, [channel.url]: status }));
      });
    });
  }, [paginatedChannels]);

  // Separate connection checks for favorites & recents
  useEffect(() => {
    const activeList = activeTab === "favorites-list" 
      ? channels.filter(c => favorites.includes(c.url))
      : recents;
      
    activeList.forEach(channel => {
      if (checkedUrlsRef.current.has(channel.url)) return;
      checkedUrlsRef.current.add(channel.url);
      
      setStreamStatus(prev => ({ ...prev, [channel.url]: "checking" }));
      
      checkStreamStatus(channel.url).then(status => {
        setStreamStatus(prev => ({ ...prev, [channel.url]: status }));
      });
    });
  }, [activeTab, favorites, recents, channels]);

  /* ==========================================================================
     Playback Controller Hooks
     ========================================================================== */

  // Handles Hls instance setups and error listeners with safety connection timeouts
  useEffect(() => {
    if (!activeChannel) return;
    
    // Clear previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    const video = videoRef.current;
    if (!video) return;
    
    video.pause();
    video.src = "";
    video.load();
    
    setIsPlaying(false);
    setPlaybackError(null);
    setIsLoadingStream(true);
    
    const url = activeChannel.url;

    // Safety connection load timeout: fail in 10 seconds if still loading
    const loadTimeoutId = setTimeout(() => {
      if (video.paused && !video.ended) {
        setIsLoadingStream(false);
        setIsPlaying(false);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        video.pause();
        video.src = "";
        video.load();
        
        let msg = "Connection timed out. The stream is unreachable.";
        if (url.includes("172.32.") || url.includes("192.168.") || url.includes("10.")) {
          msg += " This stream is hosted on a private local IP address and is only accessible if you are connected to that specific ISP's network.";
        } else {
          msg += " The streaming server might be offline, geo-blocked, or blocking requests due to browser CORS policies.";
        }
        setPlaybackError(msg);
      }
    }, 10000); // 10 seconds timeout
    
    const handleFatalHlsError = (hlsInstance, data) => {
      clearTimeout(loadTimeoutId);
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.warn("Network HLS connection failed. Attempting reconnect...");
          hlsInstance.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.warn("Media buffer error. Attempting buffer recovery...");
          hlsInstance.recoverMediaError();
          break;
        default:
          stopPlayback();
          let msg = "Could not establish connection to the stream server.";
          if (activeChannel.isGeoBlocked) {
            msg += " This channel is tagged as [Geo-blocked] and may not be viewable in your region.";
          }
          setPlaybackError(msg);
          break;
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 20,
        enableWorker: true,
        lowLatencyMode: true
      });
      hlsRef.current = hls;
      
      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => {
          console.warn("Autoplay rejected by browser policies:", e);
        });
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          handleFatalHlsError(hls, data);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple HLS streaming (Safari / Mobile Safari)
      video.src = url;
      const playHandler = () => {
        video.play().catch(e => console.warn("Native autoplay blocked", e));
      };
      video.addEventListener("loadedmetadata", playHandler);
      
      const errorHandler = () => {
        clearTimeout(loadTimeoutId);
        setPlaybackError("Direct native HLS playback failed. Stream may be offline or blocked.");
        setIsLoadingStream(false);
      };
      video.addEventListener("error", errorHandler);
      
      return () => {
        clearTimeout(loadTimeoutId);
        video.removeEventListener("loadedmetadata", playHandler);
        video.removeEventListener("error", errorHandler);
      };
    } else {
      clearTimeout(loadTimeoutId);
      setPlaybackError("Your browser does not support HLS stream playback. Try using Chrome or Edge.");
      setIsLoadingStream(false);
    }
    
    // Playback events
    const onPlaying = () => {
      clearTimeout(loadTimeoutId);
      setIsLoadingStream(false);
      setIsPlaying(true);
    };
    
    video.addEventListener("playing", onPlaying);
    
    return () => {
      clearTimeout(loadTimeoutId);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeEventListener("playing", onPlaying);
    };
  }, [activeChannel]);

  const stopPlayback = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.load();
    }
    setIsPlaying(false);
  };

  const playChannel = (channel) => {
    setActiveChannel(channel);
    
    // Push history
    setRecents(prev => {
      const filtered = prev.filter(c => c.url !== channel.url);
      const updated = [channel, ...filtered].slice(0, 10);
      localStorage.setItem("iptv_recents", JSON.stringify(updated));
      return updated;
    });
  };

  /* ==========================================================================
     Intersection Scroll Observer
     ========================================================================== */

  // Infinite Scroll Trigger
  useEffect(() => {
    if (paginatedChannels.length >= filteredChannels.length) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setPage(prev => prev + 1);
      }
    }, {
      root: document.getElementById("channels-container"),
      rootMargin: "150px"
    });
    
    const target = observerRef.current;
    if (target) observer.observe(target);
    
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [paginatedChannels, filteredChannels]);

  /* ==========================================================================
     Key & Event Listeners
     ========================================================================== */

  useEffect(() => {
    const handleKeys = (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA";
      
      if (e.code === "Space" && !isInput) {
        e.preventDefault();
        togglePlayPause();
      }
      if (e.code === "Escape") {
        setIsModalOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [isPlaying, activeChannel]);

  /* ==========================================================================
     Interactive Commands / Operations
     ========================================================================== */

  // Play/Pause Action
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video || !activeChannel) return;
    
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        addToast("Unable to resume stream playback", "error");
      });
    }
  };

  // Mute Action
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Volume Slider Sync
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = (val === 0);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {
        addToast("Fullscreen permission denied by browser", "error");
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Picture in picture
  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.readyState >= 1) {
        await video.requestPictureInPicture();
      } else {
        addToast("Wait for video load to request picture-in-picture", "info");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Favorites
  const toggleFavorite = (channel) => {
    let updated;
    const isFav = favorites.includes(channel.url);
    if (isFav) {
      updated = favorites.filter(url => url !== channel.url);
      addToast(`Removed ${channel.name} from Favorites`, "info");
    } else {
      updated = [...favorites, channel.url];
      addToast(`Added ${channel.name} to Favorites`, "success");
    }
    setFavorites(updated);
    localStorage.setItem("iptv_favorites", JSON.stringify(updated));
  };

  // Copy Stream Clipboard
  const copyStreamUrl = () => {
    if (!activeChannel) return;
    navigator.clipboard.writeText(activeChannel.url)
      .then(() => addToast("Stream URL copied to clipboard!", "success"))
      .catch(() => addToast("Clipboard copy failed", "error"));
  };

  // Toast System Push
  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Preset switch selectors
  const handlePresetSelect = (url) => {
    setActivePresetUrl(url);
    setCustomUrlInput(url);
  };

  const handleModalSubmit = () => {
    if (modalSourceTab === "url") {
      if (!customUrlInput.trim()) {
        addToast("Specify a valid playlist source URL", "error");
        return;
      }
      setIsModalOpen(false);
      fetchPlaylist(customUrlInput.trim());
    } else {
      if (!selectedFile) {
        addToast("Drag and drop or select a playlist file", "error");
        return;
      }
      setIsModalOpen(false);
      handlePlaylistFileUpload(selectedFile);
    }
  };

  // File selection
  const triggerFileBrowser = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const clearFileSelection = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ==========================================================================
     UI Render Compilations
     ========================================================================== */

  // Find category icon mapping
  const getCategoryIcon = (groupName) => {
    const name = groupName.toLowerCase();
    if (name.includes("movie") || name.includes("cinema")) return <Film className="category-item-icon" />;
    if (name.includes("news")) return <Newspaper className="category-item-icon" />;
    if (name.includes("sport") || name.includes("trophy")) return <Trophy className="category-item-icon" />;
    if (name.includes("music")) return <Music className="category-item-icon" />;
    if (name.includes("kid") || name.includes("animation")) return <Smile className="category-item-icon" />;
    if (name.includes("religio") || name.includes("church")) return <Church className="category-item-icon" />;
    if (name.includes("weather")) return <CloudSun className="category-item-icon" />;
    if (name.includes("shop")) return <ShoppingBag className="category-item-icon" />;
    if (name.includes("document") || name.includes("educat")) return <GraduationCap className="category-item-icon" />;
    return <Tv className="category-item-icon" />;
  };

  // Launch direct external VLC application (CORS bypass fallback)
  const getVlcUrl = (url) => {
    return url.replace(/^https?:\/\//, "vlc://");
  };

  return (
    <div className="app-container">
      {/* Top Header Section */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-container">
            <div className="logo-glow"></div>
            <Tv className="logo-icon" />
            <span className="logo-text">3S-<span className="logo-accent">IPTV</span></span>
          </div>
        </div>

        <div className="header-center">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              id="channel-search"
              placeholder="Search channels, categories, or country..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              autoComplete="off"
            />
            {searchQuery && (
              <button 
                id="clear-search" 
                className="clear-search-btn" 
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
              >
                <X />
              </button>
            )}
          </div>
        </div>

        <div className="header-right">
          <div className="stats-badge" id="stats-channels-count" title={`Active source: ${playlistUrl}`}>
            <span className="pulse-dot"></span>
            <span>{isPlaylistLoading ? "Loading..." : `${channels.length.toLocaleString()} Channels`}</span>
          </div>
          <button 
            id="playlist-manager-toggle" 
            className="btn btn-secondary" 
            onClick={() => setIsModalOpen(true)}
          >
            <Settings />
            <span>Playlist Source</span>
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="app-body">
        {/* Sidebar */}
        <aside className="app-sidebar" id="sidebar">
          {/* Tabs */}
          <div className="sidebar-tabs">
            <button 
              className={`tab-btn ${activeTab === "channels-list" ? "active" : ""}`}
              onClick={() => setActiveTab("channels-list")}
            >
              <List />
              <span>Channels</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === "categories-list" ? "active" : ""}`}
              onClick={() => setActiveTab("categories-list")}
            >
              <Folder />
              <span>Categories</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === "favorites-list" ? "active" : ""}`}
              onClick={() => setActiveTab("favorites-list")}
            >
              <Heart />
              <span>Favorites</span>
            </button>
          </div>

          {/* Panel 1: Channels List */}
          <div className={`tab-panel ${activeTab === "channels-list" ? "active" : ""}`} id="panel-channels-list">
            {currentCategory && (
              <div className="active-category-indicator" id="current-category-bar">
                <span>Category: {currentCategory}</span>
                <button 
                  className="reset-filter-btn" 
                  title="Clear category filter"
                  onClick={() => {
                    setCurrentCategory(null);
                    setPage(1);
                  }}
                >
                  <X />
                </button>
              </div>
            )}
            
            <div className="channel-list-scroll" id="channels-container">
              {isPlaylistLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading IPTV streams...</p>
                </div>
              ) : paginatedChannels.length === 0 ? (
                <div className="loading-state">
                  <p>No channels match your filter</p>
                </div>
              ) : (
                paginatedChannels.map((channel, i) => {
                  const isFav = favorites.includes(channel.url);
                  const isActive = activeChannel && activeChannel.url === channel.url;
                  const status = streamStatus[channel.url] || "checking";
                  
                  return (
                    <div 
                      key={channel.url + "-" + i} 
                      className={`channel-item ${isActive ? "active" : ""} ${status === "offline" ? "channel-offline" : ""}`}
                      onClick={() => playChannel(channel)}
                    >
                      <div className="active-indicator-bar"></div>
                      <div className="channel-logo-wrapper">
                        <img 
                          className="channel-logo" 
                          src={channel.logo || FALLBACK_LOGO} 
                          alt="" 
                          onError={(e) => { e.target.src = FALLBACK_LOGO; }}
                        />
                        <span 
                          className={`status-indicator ${status}`} 
                          title={status === "online" ? "Stream is Online" : status === "offline" ? "Stream is Offline or Blocked" : "Checking status..."}
                        ></span>
                      </div>
                      
                      <div className="channel-info">
                        <div className="channel-name" title={channel.name}>
                          {channel.name}
                          {isActive && isPlaying && (
                            <div className="playing-equalizer">
                              <span className="equalizer-bar"></span>
                              <span className="equalizer-bar"></span>
                              <span className="equalizer-bar"></span>
                            </div>
                          )}
                        </div>
                        <div className="channel-meta">
                          <span className="channel-tag" title={channel.group}>{channel.group}</span>
                          {channel.isGeoBlocked && <span className="badge badge-error" style={{ zoom: 0.7, padding: "2px 6px" }}>GEO</span>}
                        </div>
                      </div>
                      
                      <button 
                        className={`channel-item-fav-btn ${isFav ? "active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(channel);
                        }}
                      >
                        <Heart />
                      </button>
                    </div>
                  );
                })
              )}
              
              {/* Observer node for infinite scrolling */}
              {paginatedChannels.length < filteredChannels.length && (
                <div ref={observerRef} style={{ height: "20px", width: "100%" }}></div>
              )}
            </div>
          </div>

          {/* Panel 2: Categories List */}
          <div className={`tab-panel ${activeTab === "categories-list" ? "active" : ""}`} id="panel-categories-list">
            <div className="category-list-scroll" id="categories-container">
              {categories.map((cat, idx) => (
                <div 
                  key={cat.name + "-" + idx} 
                  className="category-item"
                  onClick={() => {
                    setCurrentCategory(cat.name);
                    setActiveTab("channels-list");
                    setPage(1);
                  }}
                >
                  <div className="category-left">
                    {getCategoryIcon(cat.name)}
                    <span className="category-name">{cat.name}</span>
                  </div>
                  <span className="category-count">{cat.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 3: Favorites List */}
          <div className={`tab-panel ${activeTab === "favorites-list" ? "active" : ""}`} id="panel-favorites-list">
            <div className="channel-list-scroll" id="favorites-container">
              {favorites.length === 0 ? (
                <div className="empty-state">
                  <Heart className="empty-state-icon" />
                  <p>No favorites added yet</p>
                  <span>Click the heart icon on any channel to save it here.</span>
                </div>
              ) : (
                channels
                  .filter(c => favorites.includes(c.url))
                  .map((channel, i) => {
                    const isActive = activeChannel && activeChannel.url === channel.url;
                    const status = streamStatus[channel.url] || "checking";
                    
                    return (
                      <div 
                        key={channel.url + "-fav-" + i} 
                        className={`channel-item ${isActive ? "active" : ""} ${status === "offline" ? "channel-offline" : ""}`}
                        onClick={() => playChannel(channel)}
                      >
                        <div className="active-indicator-bar"></div>
                        <div className="channel-logo-wrapper">
                          <img 
                            className="channel-logo" 
                            src={channel.logo || FALLBACK_LOGO} 
                            alt="" 
                            onError={(e) => { e.target.src = FALLBACK_LOGO; }}
                          />
                          <span className={`status-indicator ${status}`}></span>
                        </div>
                        <div className="channel-info">
                          <div className="channel-name" title={channel.name}>
                            {channel.name}
                            {isActive && isPlaying && (
                              <div className="playing-equalizer">
                                <span className="equalizer-bar"></span>
                                <span className="equalizer-bar"></span>
                                <span className="equalizer-bar"></span>
                              </div>
                            )}
                          </div>
                          <div className="channel-meta">
                            <span className="channel-tag">{channel.group}</span>
                          </div>
                        </div>
                        <button 
                          className="channel-item-fav-btn active"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(channel);
                          }}
                        >
                          <Heart />
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </aside>

        {/* Main Video Content */}
        <section className="main-content">
          {/* Player Aspect Wrapper */}
          <div className="player-wrapper">
            <div 
              ref={playerContainerRef} 
              className="player-aspect-container" 
              id="player-container"
              onDoubleClick={toggleFullscreen}
            >
              <video ref={videoRef} playsInline></video>

              {/* Overlay states */}
              {!activeChannel && (
                <div className="player-overlay" id="player-overlay">
                  <div className="overlay-content">
                    <Tv2 className="pulse-icon" />
                    <h3>Ready to Stream</h3>
                    <p>Select a channel from the sidebar list to start watching live TV.</p>
                    {filteredChannels.length > 0 && (
                      <button 
                        className="btn btn-primary btn-lg"
                        onClick={() => playChannel(filteredChannels[0])}
                      >
                        Play First Channel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeChannel && isLoadingStream && (
                <div className="player-overlay">
                  <div className="overlay-content">
                    <div className="stream-spinner"></div>
                    <h3>Connecting to Stream</h3>
                    <span id="loading-stream-name">{activeChannel.name}</span>
                    <p className="loading-subtext">Initializing HLS playback buffers...</p>
                  </div>
                </div>
              )}

              {activeChannel && playbackError && (
                <div className="player-overlay">
                  <div className="overlay-content">
                    <AlertTriangle className="error-icon" />
                    <h3>Unable to Play Channel</h3>
                    <p id="error-message">{playbackError}</p>
                    
                    <div className="cors-warning-box">
                      <span className="warning-title"><HelpCircle /> Browser CORS Restriction Tip</span>
                      <p>Web browsers block raw streams due to security (CORS) policies. To stream here, install a <strong>"CORS Unblock"</strong> extension in your browser, or open the link directly in <strong>VLC Media Player</strong> below.</p>
                    </div>

                    <div className="error-actions">
                      <button 
                        className="btn btn-primary"
                        onClick={() => playChannel(activeChannel)}
                      >
                        <RefreshCw /> Retry Stream
                      </button>
                      <a 
                        className="btn btn-secondary btn-link"
                        href={getVlcUrl(activeChannel.url)}
                      >
                        <PlayCircle /> Open in VLC
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Player Controls */}
              {activeChannel && !playbackError && (
                <div className="custom-controls-overlay" id="custom-controls">
                  <div className="player-progress-container">
                    <div className="player-live-badge">
                      <span className="live-dot"></span>
                      <span>LIVE</span>
                    </div>
                    <div className="player-progress-track">
                      <div className="player-progress-buffer" id="player-buffer-bar"></div>
                      <div className="player-progress-fill" id="player-progress-bar"></div>
                    </div>
                  </div>

                  <div className="controls-row">
                    <div className="controls-left">
                      <button 
                        className="control-btn" 
                        onClick={togglePlayPause} 
                        title="Play/Pause"
                      >
                        {isPlaying ? <Pause /> : <Play />}
                      </button>
                      
                      <div className="volume-container">
                        <button className="control-btn" onClick={toggleMute} title="Mute/Unmute">
                          {isMuted || volume === 0 ? <VolumeX /> : volume < 0.5 ? <Volume1 /> : <Volume2 />}
                        </button>
                        <input 
                          type="range" 
                          className="volume-slider" 
                          min="0" 
                          max="1" 
                          step="0.05" 
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                        />
                      </div>

                      <div className="active-channel-display">
                        <span className="ctrl-channel-name">{activeChannel.name}</span>
                      </div>
                    </div>

                    <div className="controls-right">
                      <button className="control-btn" onClick={togglePip} title="Picture in Picture">
                        <PictureInPicture2 />
                      </button>
                      <button className="control-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">
                        <Maximize />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details Card */}
          {activeChannel && (
            <div className="channel-details-card" id="active-channel-details">
              <div className="details-main">
                <div className="channel-logo-large-wrapper">
                  <img 
                    src={activeChannel.logo || FALLBACK_LOGO} 
                    alt="Logo" 
                    onError={(e) => { e.target.src = FALLBACK_LOGO; }}
                  />
                </div>
                <div className="details-text-group">
                  <div className="category-pill-container">
                    <span className="badge badge-accent" id="detail-category">{activeChannel.group}</span>
                    {activeChannel.isGeoBlocked && <span className="badge badge-error">Geo-blocked</span>}
                    {activeChannel.not247 && <span className="badge badge-warning">Part-Time</span>}
                  </div>
                  <h2 id="detail-name">{activeChannel.name}</h2>
                  <p className="stream-source-text">
                    <Globe /> 
                    <span id="detail-url-short" title={activeChannel.url}>
                      {activeChannel.url.split("/")[2] || "unknown source"}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="details-actions">
                <button 
                  className={`btn btn-action ${favorites.includes(activeChannel.url) ? "active" : ""}`}
                  onClick={() => toggleFavorite(activeChannel)}
                  title="Favorite Channel"
                >
                  <Heart />
                  <span>{favorites.includes(activeChannel.url) ? "Favorited" : "Favorite"}</span>
                </button>
                <button className="btn btn-action" onClick={copyStreamUrl} title="Copy Playlist URL">
                  <Copy />
                  <span>Copy URL</span>
                </button>
                <a 
                  className="btn btn-action btn-link" 
                  href={getVlcUrl(activeChannel.url)} 
                  title="Open in VLC"
                >
                  <ExternalLink />
                  <span>VLC Play</span>
                </a>
              </div>
            </div>
          )}

          {/* Recent History Grid */}
          <section className="recent-channels-section">
            <div className="section-header">
              <History className="section-icon" />
              <h3>Recently Played</h3>
            </div>
            <div className="recent-grid" id="recent-channels-grid">
              {recents.length === 0 ? (
                <div className="recent-empty-state">
                  <p>No recently viewed channels. Select a stream to start watching.</p>
                </div>
              ) : (
                recents.map((channel, idx) => {
                  const isActive = activeChannel && activeChannel.url === channel.url;
                  const status = streamStatus[channel.url] || "checking";
                  
                  return (
                    <div 
                      key={channel.url + "-recent-" + idx} 
                      className={`channel-item ${isActive ? "active" : ""} ${status === "offline" ? "channel-offline" : ""}`}
                      onClick={() => playChannel(channel)}
                    >
                      <div className="active-indicator-bar"></div>
                      <div className="channel-logo-wrapper">
                        <img 
                          className="channel-logo" 
                          src={channel.logo || FALLBACK_LOGO} 
                          alt="" 
                          onError={(e) => { e.target.src = FALLBACK_LOGO; }}
                        />
                        <span className={`status-indicator ${status}`}></span>
                      </div>
                      <div className="channel-info">
                        <div className="channel-name" title={channel.name}>
                          {channel.name}
                          {isActive && isPlaying && (
                            <div className="playing-equalizer">
                              <span className="equalizer-bar"></span>
                              <span className="equalizer-bar"></span>
                              <span className="equalizer-bar"></span>
                            </div>
                          )}
                        </div>
                        <div className="channel-meta">
                          <span className="channel-tag">{channel.group}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </section>
      </main>

      {/* Playlist Source Manager Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" id="playlist-modal">
          <div className="modal-card">
            <div className="modal-header">
              <h3>IPTV Playlist Manager</h3>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
                <X />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="source-selector-tabs">
                <button 
                  className={`source-tab ${modalSourceTab === "url" ? "active" : ""}`}
                  onClick={() => setModalSourceTab("url")}
                >
                  <LinkIcon />
                  <span>M3U URL Source</span>
                </button>
                <button 
                  className={`source-tab ${modalSourceTab === "file" ? "active" : ""}`}
                  onClick={() => setModalSourceTab("file")}
                >
                  <UploadCloud />
                  <span>Upload Local M3U</span>
                </button>
              </div>

              {/* URL Source Panel */}
              {modalSourceTab === "url" && (
                <div className="source-panel active" id="panel-src-url">
                  <p className="modal-info-text">Select or enter a public `.m3u` playlist URL to stream live television channels.</p>
                  
                  <div className="input-group">
                    <label htmlFor="m3u-url-input">Playlist URL</label>
                    <input 
                      type="url" 
                      id="m3u-url-input" 
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="https://example.com/playlist.m3u"
                    />
                  </div>

                  <div className="preset-sources">
                    <span className="presets-title">Presets:</span>
                    <div className="presets-buttons">
                      <button 
                        className={`btn btn-preset ${activePresetUrl === "https://lupael.github.io/IPTV/running.m3u" ? "active" : ""}`}
                        onClick={() => handlePresetSelect("https://lupael.github.io/IPTV/running.m3u")}
                      >
                        Lupael List (Default)
                      </button>
                      <button 
                        className={`btn btn-preset ${activePresetUrl === "https://iptv-org.github.io/iptv/index.m3u" ? "active" : ""}`}
                        onClick={() => handlePresetSelect("https://iptv-org.github.io/iptv/index.m3u")}
                      >
                        IPTV-org (8,000+ Channels)
                      </button>
                    </div>

                    <div className="presets-row">
                      <div className="select-group">
                        <label htmlFor="category-preset-select">Or Filter by Category</label>
                        <select 
                          id="category-preset-select"
                          className="preset-select"
                          onChange={(e) => {
                            if (e.target.value) {
                              handlePresetSelect(e.target.value);
                            }
                          }}
                          value={PRESET_CATEGORIES.some(c => c.url === activePresetUrl) ? activePresetUrl : ""}
                        >
                          <option value="">-- Choose Category --</option>
                          {PRESET_CATEGORIES.map((cat, i) => (
                            <option key={i} value={cat.url}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="select-group">
                        <label htmlFor="language-preset-select">Or Filter by Language</label>
                        <select 
                          id="language-preset-select"
                          className="preset-select"
                          onChange={(e) => {
                            if (e.target.value) {
                              handlePresetSelect(e.target.value);
                            }
                          }}
                          value={PRESET_LANGUAGES.some(l => l.url === activePresetUrl) ? activePresetUrl : ""}
                        >
                          <option value="">-- Choose Language --</option>
                          {PRESET_LANGUAGES.map((lang, i) => (
                            <option key={i} value={lang.url}>{lang.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* File Source Panel */}
              {modalSourceTab === "file" && (
                <div className="source-panel active" id="panel-src-file">
                  <p className="modal-info-text">Upload your own offline M3U playlist file directly from your computer. Ideal if you have personal IPTV subscriptions.</p>
                  
                  <div 
                    className="file-drag-area" 
                    id="file-drag-container"
                    onClick={triggerFileBrowser}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files.length > 0) {
                        setSelectedFile(e.dataTransfer.files[0]);
                      }
                    }}
                  >
                    <Upload className="upload-big-icon" />
                    <p>Drag and drop your <strong>.m3u</strong> or <strong>.m3u8</strong> playlist file here</p>
                    <span>or click to browse local files</span>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".m3u,.m3u8" 
                      style={{ display: "none" }}
                    />
                  </div>
                  
                  {selectedFile && (
                    <div className="file-selected-info" id="file-selected-info">
                      <FileText />
                      <span id="selected-file-name">{selectedFile.name}</span>
                      <button id="remove-file-btn" onClick={clearFileSelection}>
                        <Trash2 />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleModalSubmit} disabled={isPlaylistLoading}>
                {isPlaylistLoading && <RefreshCw className="btn-loader-icon" />}
                <span>{isPlaylistLoading ? "Loading..." : "Load Playlist"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <div className="toast-container" id="toast-container">
        {toasts.map(toast => {
          let Icon = Info;
          if (toast.type === "success") Icon = CheckCircle;
          if (toast.type === "error") Icon = AlertOctagon;
          
          return (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <Icon className={`toast-icon ${toast.type}`} />
              <span className="toast-message">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Local wrapper mapping Info component since Info wasn't in direct lucide list as Info name
function Info(props) {
  return <HelpCircle {...props} />;
}
