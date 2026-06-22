import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// App icon (favicon + PWA / maskable). Glyph kept within the central 80% safe
// zone so it survives maskable cropping on Android.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(at 30% 20%, #8b5cf6 0, transparent 60%), radial-gradient(at 80% 90%, #06b6d4 0, transparent 60%), #0b1120",
        }}
      >
        <svg width="280" height="280" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="15" rx="2" />
          <polyline points="17 2 12 7 7 2" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
