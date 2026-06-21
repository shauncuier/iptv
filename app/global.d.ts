// Ambient declarations for untyped deps and non-standard DOM APIs used by the app.

declare module "iptv-playlist-parser" {
  interface PlaylistItem {
    name: string;
    url: string;
    raw: string;
    tvg: { id: string; logo: string };
    group: { title: string };
  }
  interface Playlist {
    items: PlaylistItem[];
  }
  const parser: { parse(text: string): Playlist };
  export default parser;
}

// Google Cast SDK + Safari AirPlay are injected at runtime; type them loosely.
declare global {
  interface Window {
    cast?: any;
    chrome?: any;
    __onGCastApiAvailable?: (available: boolean) => void;
    WebKitPlaybackTargetAvailabilityEvent?: any;
  }
  interface HTMLVideoElement {
    webkitShowPlaybackTargetPicker?: () => void;
    webkitEnterFullscreen?: () => void;
    webkitSupportsFullscreen?: boolean;
  }
}

// Allow the non-standard x-webkit-airplay attribute on <video>.
declare namespace React {
  interface VideoHTMLAttributes<T> {
    "x-webkit-airplay"?: string;
  }
}

export {};
