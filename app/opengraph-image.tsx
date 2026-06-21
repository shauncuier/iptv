import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "3S-IPTV — Free Live TV · 8,000+ Channels";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamically generated social share card (Open Graph + Twitter).
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(at 0% 0%, rgba(139,92,246,0.30) 0, transparent 55%), radial-gradient(at 100% 100%, rgba(6,182,212,0.30) 0, transparent 55%), #080c14",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="15" rx="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
          <div style={{ display: "flex", fontSize: 110, fontWeight: 800, letterSpacing: -2 }}>
            <span>3S-</span>
            <span
              style={{
                background: "linear-gradient(135deg,#8b5cf6 0%,#06b6d4 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              IPTV
            </span>
          </div>
        </div>
        <div style={{ marginTop: 24, fontSize: 40, fontWeight: 600, color: "#cbd5e1" }}>
          Free Live TV · 8,000+ Channels
        </div>
        <div style={{ marginTop: 16, fontSize: 26, color: "#64748b" }}>
          HLS · MPEG-TS · Chromecast · AirPlay
        </div>
        <div style={{ marginTop: 56, fontSize: 24, color: "#94a3b8" }}>
          Designed &amp; developed by{" "}
          <span style={{ marginLeft: 8, fontWeight: 700, color: "#a78bfa" }}>3S-Soft</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
