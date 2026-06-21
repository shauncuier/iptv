"use client";

import React from "react";
import {
  Play, Pause, Volume1, Volume2, VolumeX, Sun, Loader2, AlertTriangle,
  HelpCircle, RefreshCw, PlayCircle, Zap, Settings, Activity, Cast, Airplay,
  PictureInPicture2, Maximize,
} from "lucide-react";
import type { Channel } from "../lib/types";
import type { usePlayer } from "../hooks/usePlayer";

interface VideoPlayerProps {
  player: ReturnType<typeof usePlayer>;
  activeChannel: Channel | null;
  onRetry: () => void;
  idle: React.ReactNode;
}

/**
 * VideoPlayer — presentational shell for the player: video element, overlays
 * (stats HUD, loading, buffering, gesture hint, error) and the control bar.
 * All behaviour comes from the `player` object returned by usePlayer; the idle
 * (no-channel) overlay is injected by the host page via the `idle` slot.
 */
export default function VideoPlayer({ player, activeChannel, onRetry, idle }: VideoPlayerProps) {
  const {
    videoRef, playerContainerRef,
    isPlaying, isMuted, volume, isLoadingStream, playbackError, aspectRatio,
    showStats, setShowStats, stats, hlsLevels, currentLevel, isBuffering,
    dataSaver, brightness, gestureHint, castAvailable, isCasting,
    airplayAvailable, controlsVisible, setControlsVisible,
    handleQualityChange, toggleDataSaver, toggleAspectRatio,
    revealControls, togglePlay, toggleMute, handleVolume, toggleFullscreen,
    togglePip, showAirPlay, toggleCast, onTouchStart, onTouchMove, onTouchEnd,
  } = player;

  return (
    <div
      ref={playerContainerRef}
      className={`player-container relative w-full flex-shrink-0 bg-black rounded-xl sm:rounded-2xl overflow-hidden border border-white/[0.06] shadow-[0_16px_48px_rgba(0,0,0,0.6)] ${controlsVisible ? "controls-visible" : ""}`}
      style={{ aspectRatio: "16/9", maxHeight: "calc(100svh - 60px - 180px)" }}
      onMouseMove={revealControls}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      onDoubleClick={toggleFullscreen}
    >
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

      {/* Overlay: idle (injected by host page) */}
      {!activeChannel && idle}

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
                <button onClick={onRetry}
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
  );
}
