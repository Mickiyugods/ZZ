import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The card shown when a ZEEP link is shared (X, Telegram, Discord, iMessage…).
export const alt = "ZEEP — memecoins with a reserve inside";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ZEEP's display face (Bricolage Grotesque 700). Google Fonts serves a TTF to
// an old user agent, which is what the OG renderer needs. If the fetch fails
// the card still renders, in the renderer's built-in sans.
async function brandFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700", {
      headers: { "User-Agent": "Mozilla/4.0" },
      signal: AbortSignal.timeout(6000),
    }).then((r) => r.text());
    const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!url) return null;
    return await fetch(url, { signal: AbortSignal.timeout(6000) }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [logo, font] = await Promise.all([readFile(path.join(process.cwd(), "public/images/brand/zeep-logo.png")), brandFont()]);
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#000",
          fontFamily: font ? "Bricolage" : undefined,
          backgroundImage: "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.10), transparent 45%)",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={88} height={80} alt="" />
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>ZEEP</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5 }}>Every trade feeds</div>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5 }}>the reserve.</div>
          <div style={{ marginTop: 26, fontSize: 28, color: "#a3a3a3" }}>Memecoins with an NFT reserve inside · built on Pons · Robinhood Chain</div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Bricolage", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
