"use client";

import { Tag, X, Film, Languages, MapPin, Globe } from "lucide-react";
import CategoryIcon from "./CategoryIcon";
import { flagEmoji } from "../lib/stream";
import { IPTV_ORG_CATEGORIES, IPTV_ORG_LANGUAGES, IPTV_ORG_COUNTRIES } from "../lib/constants";

interface BrowsePanelProps {
  onClose: () => void;
  fetchPlaylist: (url: string) => void;
  activePresetUrl: string;
  setActivePresetUrl: (url: string) => void;
}

/** Slide-over quick-browse panel: pick a category / language / country preset. */
export default function BrowsePanel({ onClose, fetchPlaylist, activePresetUrl, setActivePresetUrl }: BrowsePanelProps) {
  const pick = (url: string) => { onClose(); fetchPlaylist(url); setActivePresetUrl(url); };
  const chipClass = (url: string) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:-translate-y-px whitespace-nowrap ${
      activePresetUrl === url
        ? "bg-violet-500/20 border-violet-500 text-violet-300"
        : "bg-white/[0.04] border-white/[0.07] text-slate-400 hover:bg-violet-500/10 hover:border-violet-500/40 hover:text-slate-200"
    }`;

  const sections = [
    {
      label: "Categories",
      icon: <Film className="w-3.5 h-3.5 text-violet-400" />,
      items: IPTV_ORG_CATEGORIES,
      renderChip: (c: any) => (
        <button key={c.url} onClick={() => pick(c.url)} className={chipClass(c.url)}>
          <CategoryIcon name={c.name} className="w-3 h-3" />{c.name}
          <em className="not-italic opacity-40 text-[10px]">{c.count.toLocaleString()}</em>
        </button>
      ),
    },
    {
      label: "Languages",
      icon: <Languages className="w-3.5 h-3.5 text-violet-400" />,
      items: IPTV_ORG_LANGUAGES,
      renderChip: (l: any) => (
        <button key={l.url} onClick={() => pick(l.url)} className={chipClass(l.url)}>
          <Globe className="w-3 h-3" />{l.name}
        </button>
      ),
    },
    {
      label: "Countries",
      icon: <MapPin className="w-3.5 h-3.5 text-violet-400" />,
      items: IPTV_ORG_COUNTRIES,
      renderChip: (c: any) => (
        <button key={c.url} onClick={() => pick(c.url)} className={chipClass(c.url)}>
          <span className="text-sm">{flagEmoji(c.code)}</span>{c.name}
        </button>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="browse-panel w-[500px] max-w-[90vw] h-full flex flex-col glass bg-[rgba(11,17,30,0.98)] border-l border-white/[0.07]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] flex-shrink-0">
          <h3 className="flex items-center gap-2.5 font-['Outfit'] text-base font-bold">
            <Tag className="w-4 h-4 text-violet-400" /> Quick Browse
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-7">
          {sections.map((section) => (
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
  );
}
