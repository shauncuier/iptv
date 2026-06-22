"use client";

import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";
import type { Channel, StreamStatusValue } from "../lib/types";

type ToastFn = (message: string, type?: string) => void;
type StatusSetter = React.Dispatch<
  React.SetStateAction<Record<string, StreamStatusValue>>
>;

interface UsePlayerArgs {
  activeChannel: Channel | null;
  addToast: ToastFn;
  setStreamStatus: StatusSetter;
}

/**
 * usePlayer — owns the entire playback engine and player UI state:
 * HLS.js / mpegts.js lifecycle, media-element controls, stats, buffering,
 * Cast/AirPlay, mobile gestures, keyboard shortcuts and the auto-hiding
 * controls overlay. The host page wires `activeChannel` in and reads the
 * returned state/handlers straight into the player JSX.
 */
export function usePlayer({ activeChannel, addToast, setStreamStatus }: UsePlayerArgs) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [aspectRatio, setAspectRatio] = useState("contain");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    resolution: "N/A",
    bitrate: "N/A",
    buffer: "0",
    droppedFrames: 0,
  });
  const [hlsLevels, setHlsLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [dataSaver, setDataSaver] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("iptv_datasaver") === "1"
  );
  const [brightness, setBrightness] = useState(1);
  const [gestureHint, setGestureHint] = useState<any>(null);
  const [castAvailable, setCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [airplayAvailable, setAirplayAvailable] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<any>(null);
  const mpegtsModuleRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef<any>(null);
  const controlsTimerRef = useRef<any>(null);

  /* Load the client-only mpegts.js library once. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("mpegts.js")
      .then((mod) => {
        mpegtsModuleRef.current = (mod as any).default || mod;
      })
      .catch((err) => console.error("Failed to load mpegts.js:", err));
  }, []);

  /* HLS / mpegts playback engine */
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
    // while the load is in flight, abandon this one.
    let cancelled = false;
    let started = false;     // true once real playback begins
    let netRetries = 0;      // cap NETWORK_ERROR recovery attempts
    let timeout: any;        // the hard ceiling

    const cleanup = () => {
      cancelled = true;
      clearTimeout(timeout);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (mpegtsRef.current) { mpegtsRef.current.destroy(); mpegtsRef.current = null; }
    };

    const failStream = (msg: string) => {
      if (started || cancelled) return;   // already playing or superseded
      cleanup();
      video.pause(); video.src = ""; video.load();
      setStreamStatus((p) => ({ ...p, [url]: "offline" }));
      setPlaybackError(msg);
      setIsLoadingStream(false); setIsPlaying(false);
    };

    const onPlaying = () => {
      started = true; clearTimeout(timeout);
      setIsLoadingStream(false); setIsPlaying(true);
      setStreamStatus((p) => ({ ...p, [url]: "online" }));
    };

    // Hard ceiling: if playback hasn't started in 20s after the manifest began
    // loading, give up. Guard on `started`, NOT video.paused — play() flips
    // paused=false while still buffering, which made the old check never fire.
    const startHardTimeout = () => {
      timeout = setTimeout(() => {
        failStream("Timed out waiting for the first video frame (20s). The manifest loaded but media segments could not be buffered — the CDN serving this stream may be geo-blocked or overloaded from this server's region.");
      }, 20000);
    };

    const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

    const beginPlayback = () => {
      if (cancelled) return;
      startHardTimeout();

      const isMpegTS = url.toLowerCase().split("?")[0].endsWith(".ts");
      const mpegts = mpegtsModuleRef.current;

      if (isMpegTS && mpegts && mpegts.isSupported()) {
        try {
          // Absolute URL: with enableWorker the IO loader runs in a Web Worker
          // whose base is a blob: origin, so a relative "/api/proxy?..." would
          // resolve against the blob and throw NetworkError/Exception.
          const mpegtsUrl = new URL(proxiedUrl, window.location.origin).toString();
          const mpegtsPlayer = mpegts.createPlayer(
            { type: "mpegts", url: mpegtsUrl, isLive: true },
            { enableWorker: true, enableStashBuffer: false, liveBufferLatencyChaser: true }
          );
          mpegtsRef.current = mpegtsPlayer;
          mpegtsPlayer.attachMediaElement(video);
          mpegtsPlayer.load();
          mpegtsPlayer.play().catch(() => {});

          let mpegtsRetries = 0;
          mpegtsPlayer.on(mpegts.Events.ERROR, (type: any, detail: any, info: any) => {
            if (cancelled || started) return;
            // Recover a couple of times on transient network errors, then give up.
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
            if (!cancelled) { setHlsLevels([]); setCurrentLevel(-1); }
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
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          // Data Saver: cap auto-ABR to the lowest rendition (index 0 is smallest).
          hls.autoLevelCapping = dataSaver ? 0 : -1;
          setHlsLevels(hls.levels || []);
          setCurrentLevel(hls.currentLevel);
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          if (cancelled) return;
          setCurrentLevel(hls.currentLevel);
        });
        hls.on(Hls.Events.ERROR, (_evt: any, d: any) => {
          if (!d.fatal || cancelled) return;
          const isKeyError =
            d.details === Hls.ErrorDetails.KEY_LOAD_ERROR ||
            d.details === Hls.ErrorDetails.KEY_LOAD_TIMEOUT;
          if (isKeyError) {
            failStream("Stream uses AES-128 encryption and its key server blocked the request. Try another channel or open in VLC.");
          } else if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
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

    beginPlayback();

    return () => { cleanup(); video.removeEventListener("playing", onPlaying); };
  }, [activeChannel, dataSaver, setStreamStatus]);

  /* Stats for Nerds — sampled once a second while the HUD is open */
  useEffect(() => {
    if (!isPlaying || !showStats || !videoRef.current) return;
    const interval = setInterval(() => {
      const v = videoRef.current;
      const hls = hlsRef.current;
      if (!v) return;

      let bufferLen = 0;
      if (v.buffered && v.buffered.length > 0) {
        for (let i = 0; i < v.buffered.length; i++) {
          if (v.currentTime >= v.buffered.start(i) && v.currentTime <= v.buffered.end(i)) {
            bufferLen = v.buffered.end(i) - v.currentTime;
            break;
          }
        }
      }

      let resolution = v.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : "N/A";
      let bitrate = "N/A";
      if (hls && hls.levels && hls.currentLevel !== undefined && hls.levels[hls.currentLevel]) {
        const lvl = hls.levels[hls.currentLevel];
        bitrate = `${(lvl.bitrate / 1000000).toFixed(2)} Mbps`;
        if (!v.videoWidth && lvl.width) resolution = `${lvl.width}x${lvl.height}`;
      }

      let dropped = 0;
      if (v.getVideoPlaybackQuality) dropped = v.getVideoPlaybackQuality().droppedVideoFrames;

      setStats({ resolution, bitrate, buffer: bufferLen.toFixed(1), droppedFrames: dropped });
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
    const handler = (e: any) => setAirplayAvailable(e.availability === "available");
    v.addEventListener("webkitplaybacktargetavailabilitychanged", handler as any);
    return () => v.removeEventListener("webkitplaybacktargetavailabilitychanged", handler as any);
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
    window.__onGCastApiAvailable = (available: boolean) => { if (available) initCast(); };
    const s = document.createElement("script");
    s.id = "cast-sdk";
    s.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  /* Media keyboard shortcuts — space play/pause, f fullscreen, m mute, ↑↓ volume */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || "");
      if (isInput || !activeChannel) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
      else if (e.key === "m" || e.key === "M") { e.preventDefault(); toggleMute(); }
      else if (e.code === "ArrowUp") { e.preventDefault(); nudgeVolume(0.05); }
      else if (e.code === "ArrowDown") { e.preventDefault(); nudgeVolume(-0.05); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeChannel, isMuted, volume]);

  // Keep the media element's volume/mute in sync with React state — covers the
  // initial channel load (video defaults to 1.0, ignoring the 0.8 state).
  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.volume = volume; v.muted = isMuted; }
  }, [volume, isMuted, activeChannel, isLoadingStream]);

  // Auto-hide player controls after inactivity; reveal on pointer/touch move.
  useEffect(() => {
    revealControls();
    return () => clearTimeout(controlsTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeChannel]);

  /* ---- handlers ---- */
  const handleQualityChange = (levelIndex: number) => {
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
    setDataSaver((prev) => {
      const next = !prev;
      localStorage.setItem("iptv_datasaver", next ? "1" : "0");
      addToast(next ? "Data Saver on — lowest quality, less buffering" : "Data Saver off", "info");
      return next;
    });
  };

  const toggleAspectRatio = () => {
    setAspectRatio((prev) => (prev === "contain" ? "cover" : prev === "cover" ? "fill" : "contain"));
  };

  function nudgeVolume(delta: number) {
    const nv = Math.min(1, Math.max(0, volume + delta));
    setVolume(nv); setIsMuted(nv === 0);
    if (videoRef.current) { videoRef.current.volume = nv; videoRef.current.muted = nv === 0; }
    setGestureHint({ type: "volume", value: Math.round(nv * 100) });
    setTimeout(() => setGestureHint(null), 600);
  }

  function revealControls() {
    setControlsVisible(true);
    clearTimeout(controlsTimerRef.current);
    if (isPlaying) controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3500);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v || !activeChannel) return;
    if (isPlaying) { v.pause(); setIsPlaying(false); }
    else v.play().then(() => setIsPlaying(true)).catch(() => addToast("Cannot resume stream", "error"));
  }

  function toggleMute() { const v = videoRef.current; if (!v) return; v.muted = !isMuted; setIsMuted(!isMuted); }

  const handleVolume = (e: any) => {
    const val = parseFloat(e.target.value); setVolume(val); setIsMuted(val === 0);
    if (videoRef.current) { videoRef.current.volume = val; videoRef.current.muted = val === 0; }
  };

  function toggleFullscreen() {
    const c = playerContainerRef.current;
    const v = videoRef.current;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    // Standard fullscreen (desktop, Android, iPad). iPhone Safari has no element
    // fullscreen — fall back to putting the <video> itself in native fullscreen.
    if (c?.requestFullscreen) {
      c.requestFullscreen().catch(() => addToast("Fullscreen denied", "error"));
    } else if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
    } else {
      addToast("Fullscreen not supported on this device", "error");
    }
  }

  const togglePip = async () => {
    const v = videoRef.current; if (!v) return;
    try {
      document.pictureInPictureElement
        ? await document.exitPictureInPicture()
        : v.readyState >= 1
        ? await v.requestPictureInPicture()
        : addToast("Wait for stream to load", "info");
    } catch {}
  };

  const showAirPlay = () => {
    try { videoRef.current?.webkitShowPlaybackTargetPicker?.(); }
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
  const onTouchStart = (e: any) => {
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
  const onTouchMove = (e: any) => {
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
      setControlsVisible((v) => !v);
      clearTimeout(controlsTimerRef.current);
      if (isPlaying) controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3500);
    }
    touchRef.current = null;
    setTimeout(() => setGestureHint(null), 600);
  };

  return {
    // refs
    videoRef, playerContainerRef,
    // state
    isPlaying, isMuted, volume, isLoadingStream, playbackError, aspectRatio,
    showStats, setShowStats, stats, hlsLevels, currentLevel, isBuffering,
    dataSaver, brightness, gestureHint, castAvailable, isCasting,
    airplayAvailable, controlsVisible, setControlsVisible,
    // handlers
    handleQualityChange, toggleDataSaver, toggleAspectRatio, nudgeVolume,
    revealControls, togglePlay, toggleMute, handleVolume, toggleFullscreen,
    togglePip, showAirPlay, toggleCast, onTouchStart, onTouchMove, onTouchEnd,
  };
}
