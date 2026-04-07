import { NextRequest, NextResponse } from "next/server";
import { Innertube } from "youtubei.js";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const yt = await Innertube.create();
    const info = await yt.getBasicInfo(videoId);

    const details = info.basic_info;

    return NextResponse.json({
      title: details.title || "",
      duration: details.duration || 0,
      thumbnail: details.thumbnail?.[0]?.url || "",
      description: details.short_description || "",
      channel: details.channel?.name || details.author || "",
      videoId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch video info";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
