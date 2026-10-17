import { NextResponse } from "next/server";

// Stores a coin's logo image on IPFS via Pinata and hands back an https URL.
// Mirrors the approach used on Curato. Without PINATA_JWT the feature is simply
// disabled and the launch form falls back to a pasted image URL.

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

// GET tells the form whether uploads are available on this deployment.
export function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.PINATA_JWT) });
}

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json({ error: "Image upload isn't set up here — paste an image URL instead." }, { status: 501 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, WebP, GIF or SVG." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });

  const body = new FormData();
  body.append("file", file);
  body.append("network", "public");

  try {
    const res = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body,
    });
    if (!res.ok) return NextResponse.json({ error: "The upload service rejected the file." }, { status: 502 });
    const json = (await res.json()) as { data?: { cid?: string } };
    const cid = json.data?.cid;
    if (!cid) return NextResponse.json({ error: "The upload service returned no CID." }, { status: 502 });
    const gateway = (process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud").replace(/\/$/, "");
    return NextResponse.json({ url: `${gateway}/ipfs/${cid}`, cid });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the upload service." }, { status: 502 });
  }
}
