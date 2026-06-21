// Shared domain types for the IPTV app.

export interface Channel {
  name: string;
  logo: string;
  group: string;
  tvgId: string;
  country: string;
  language: string;
  isGeoBlocked: boolean;
  not247: boolean;
  url: string;
}

export type StreamStatusValue = "online" | "offline" | "checking";

export type StreamStatusMap = Record<string, StreamStatusValue>;

export interface PresetSource {
  name: string;
  url: string;
}

export interface CategoryPreset {
  name: string;
  url: string;
  count: number;
}

export interface LanguagePreset {
  name: string;
  url: string;
}

export interface CountryPreset {
  name: string;
  code: string;
  url: string;
}

export interface LocalPlaylist {
  name: string;
  url: string;
  size?: number;
}
