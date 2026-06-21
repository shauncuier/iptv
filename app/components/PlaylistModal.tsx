"use client";

import React from "react";
import {
  Settings, X, Tv, Tag, Languages, MapPin, Link as LinkIcon, UploadCloud,
  Zap, FileText, Upload, Trash2, RefreshCw,
} from "lucide-react";
import CategoryIcon from "./CategoryIcon";
import { flagEmoji } from "../lib/stream";
import IPTV_SOURCES from "@/sources.config.js";
import {
  DEFAULT_PLAYLIST, IPTV_ORG_CATEGORIES, IPTV_ORG_LANGUAGES, IPTV_ORG_COUNTRIES,
} from "../lib/constants";
import type { LocalPlaylist } from "../lib/types";

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalTab: string;
  setModalTab: (t: string) => void;
  customUrlInput: string;
  setCustomUrlInput: (v: string) => void;
  activePresetUrl: string;
  setActivePresetUrl: (v: string) => void;
  loadAllSources: boolean;
  setLoadAllSources: React.Dispatch<React.SetStateAction<boolean>>;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  localPlaylists: LocalPlaylist[];
  isUploading: boolean;
  isPlaylistLoading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setPlaylistUrl: (v: string) => void;
  fetchPlaylist: (url: string) => void;
  fetchMultiplePlaylists: (sources: { name: string; url: string }[]) => void;
  uploadAndLoadFile: (file: File) => void;
  deleteLocalPlaylist: (name: string) => void;
  handleFileUpload: (file: File) => void;
  addToast: (message: string, type?: string) => void;
}

/** IPTV Playlist Manager modal — sources / category / language / country / URL / upload. */
export default function PlaylistModal(props: PlaylistModalProps) {
  const {
    isOpen, onClose, modalTab, setModalTab, customUrlInput, setCustomUrlInput,
    activePresetUrl, setActivePresetUrl, loadAllSources, setLoadAllSources,
    selectedFile, setSelectedFile, localPlaylists, isUploading, isPlaylistLoading,
    fileInputRef, setPlaylistUrl, fetchPlaylist, fetchMultiplePlaylists,
    uploadAndLoadFile, deleteLocalPlaylist, handleFileUpload, addToast,
  } = props;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(3,7,18,0.75)] backdrop-blur-lg">
      <div className="w-full max-w-xl bg-[#0d131f] border border-white/10 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_30px_rgba(139,92,246,0.15)] overflow-hidden animate-[fadeUp_0.25s_ease]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <h3 className="flex items-center gap-2.5 font-['Outfit'] text-lg font-bold">
            <Settings className="w-5 h-5 text-violet-400" /> IPTV Playlist Manager
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"><X className="w-5 h-5" /></button>
        </div>

        {/* Modal tabs */}
        <div className="flex gap-1.5 p-1.5 mx-6 mt-5 bg-black/25 rounded-xl border border-white/[0.06] overflow-x-auto scrollbar-none whitespace-nowrap">
          {[
            { id: "sources", icon: <Tv className="w-3.5 h-3.5" />, label: "All Sources" },
            { id: "category", icon: <Tag className="w-3.5 h-3.5" />, label: "Category" },
            { id: "language", icon: <Languages className="w-3.5 h-3.5" />, label: "Language" },
            { id: "country", icon: <MapPin className="w-3.5 h-3.5" />, label: "Country" },
            { id: "url", icon: <LinkIcon className="w-3.5 h-3.5" />, label: "Custom URL" },
            { id: "file", icon: <UploadCloud className="w-3.5 h-3.5" />, label: "Upload" },
          ].map((t) => (
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
                    onClose();
                    const allSources = [
                      ...IPTV_SOURCES,
                      ...localPlaylists.map((pl) => ({ name: pl.name, url: pl.url })),
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
                  {IPTV_SOURCES.map((src) => (
                    <button
                      key={src.url}
                      onClick={() => { onClose(); fetchPlaylist(src.url); setPlaylistUrl(src.name); }}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-violet-500/5 hover:border-violet-500/20 transition-all text-left group"
                    >
                      <Tv className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">{src.name}</p>
                        <p className="text-[10px] text-slate-500 truncate" title={src.url}>{src.url.split("/")[2] || "Config Source"}</p>
                      </div>
                    </button>
                  ))}

                  {localPlaylists.map((pl) => (
                    <button
                      key={pl.url}
                      onClick={() => { onClose(); fetchPlaylist(pl.url); setPlaylistUrl(`Local: ${pl.name}`); }}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-violet-500/10 bg-violet-500/[0.02] hover:bg-violet-500/10 hover:border-violet-500/30 transition-all text-left group"
                    >
                      <FileText className="w-4 h-4 text-violet-400 group-hover:text-violet-300 transition-colors flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">{pl.name}</p>
                        <p className="text-[10px] text-violet-400 font-medium truncate">Uploaded File ({((pl.size ?? 0) / 1024).toFixed(0)} KB)</p>
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
              {IPTV_SOURCES && IPTV_SOURCES.length > 0 && (
                <button onClick={() => setLoadAllSources((v) => !v)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left w-full
                    ${loadAllSources ? "bg-gradient-to-r from-violet-500/20 to-cyan-500/15 border-violet-500/50" : "bg-gradient-to-r from-violet-500/8 to-cyan-500/5 border-violet-500/25 hover:border-violet-500/40"}`}>
                  <Zap className="w-5 h-5 text-violet-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-100">⚡ All Configured Sources ({IPTV_SOURCES.length})</p>
                    <p className="text-xs text-slate-500 mt-0.5">Merge every source from <code className="bg-white/5 px-1 rounded">sources.config.mjs</code> into one list</p>
                  </div>
                </button>
              )}
              <button onClick={() => { setActivePresetUrl(DEFAULT_PLAYLIST); setLoadAllSources(false); }}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left w-full
                  ${!loadAllSources && activePresetUrl === DEFAULT_PLAYLIST ? "bg-violet-500/15 border-violet-500/50" : "bg-white/[0.03] border-white/[0.07] hover:bg-violet-500/8 hover:border-violet-500/25"}`}>
                <Zap className="w-5 h-5 text-violet-400 flex-shrink-0" />
                <div><p className="text-sm font-semibold text-slate-200">All Categories (index.category.m3u)</p><p className="text-xs text-slate-500 mt-0.5">Complete iptv-org playlist — 8,000+ channels</p></div>
              </button>
              <div className="grid grid-cols-2 gap-2">
                {IPTV_ORG_CATEGORIES.map((cat) => (
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
                {IPTV_ORG_LANGUAGES.map((lang) => (
                  <button key={lang.url} onClick={() => setActivePresetUrl(lang.url)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left
                      ${activePresetUrl === lang.url ? "bg-violet-500/15 border-violet-500/50" : "bg-white/[0.03] border-white/[0.07] hover:bg-violet-500/8 hover:border-violet-500/25 hover:-translate-y-px"}`}>
                    <Languages className="w-4 h-4 text-violet-400 flex-shrink-0" />
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
                {IPTV_ORG_COUNTRIES.map((c) => (
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
                <input id="m3u-url-input" type="url" value={customUrlInput} onChange={(e) => { setCustomUrlInput(e.target.value); setActivePresetUrl(e.target.value); }}
                  placeholder="https://example.com/playlist.m3u"
                  className="h-11 bg-black/25 border border-white/[0.08] rounded-xl px-4 text-sm text-slate-200 placeholder:text-slate-600
                    focus:outline-none focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Quick Presets</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["All Categories", DEFAULT_PLAYLIST],
                    ["Full Index", "https://iptv-org.github.io/iptv/index.m3u"],
                    ["Lupael IPTV", "https://lupael.github.io/IPTV/running.m3u"],
                    ["Mrgify BDIX", "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/playlist.m3u"],
                    ["By Language", "https://iptv-org.github.io/iptv/index.language.m3u"],
                    ["By Country", "https://iptv-org.github.io/iptv/index.country.m3u"],
                  ] as [string, string][]).map(([label, url]) => (
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setSelectedFile(e.dataTransfer.files[0]); }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-all">
                <Upload className="w-8 h-8 text-slate-600" />
                <p className="text-xs text-slate-400">Drag & drop your <strong className="text-slate-300">.m3u</strong> file</p>
                <span className="text-[10px] text-slate-600">or click to browse</span>
                <input ref={fileInputRef} type="file" accept=".m3u,.m3u8" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }} />
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-slate-300 truncate flex-1">{selectedFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button disabled={isUploading} onClick={() => uploadAndLoadFile(selectedFile)}
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold transition-all">
                      {isUploading ? "Uploading..." : "Upload & Save"}
                    </button>
                    <button disabled={isUploading} onClick={() => setSelectedFile(null)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 mt-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saved Playlists on Server</p>
                {localPlaylists.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">No playlists saved on server yet.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {localPlaylists.map((pl) => (
                      <div key={pl.name} className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] transition-all">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-200 truncate">{pl.name}</p>
                            <p className="text-[10px] text-slate-500">{((pl.size ?? 0) / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3">
                          <button onClick={() => { onClose(); fetchPlaylist(pl.url); setPlaylistUrl(`Local: ${pl.name}`); }}
                            className="px-2.5 py-1 rounded bg-violet-600/80 hover:bg-violet-600 text-white text-[10px] font-bold transition-all">
                            Load
                          </button>
                          <button onClick={() => deleteLocalPlaylist(pl.name)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete from server">
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
          <button onClick={onClose}
            className="h-10 px-5 rounded-xl text-sm font-semibold border border-white/[0.07] text-slate-400 hover:border-white/[0.12] hover:text-slate-200 transition-all">
            Cancel
          </button>
          <button disabled={isPlaylistLoading}
            onClick={() => {
              if (modalTab === "file") {
                if (!selectedFile) return addToast("Select an M3U file first", "error");
                onClose(); handleFileUpload(selectedFile);
              } else if (modalTab === "category" && loadAllSources && IPTV_SOURCES.length) {
                onClose(); fetchMultiplePlaylists(IPTV_SOURCES);
              } else {
                if (!activePresetUrl) return addToast("Select or enter a playlist URL", "error");
                onClose(); fetchPlaylist(activePresetUrl);
              }
            }}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold bg-accent-gradient text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.5)] hover:-translate-y-px transition-all disabled:opacity-60 disabled:pointer-events-none">
            {isPlaylistLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            {isPlaylistLoading ? "Loading…" : "Load Playlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
