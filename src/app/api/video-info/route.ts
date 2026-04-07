import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, getInnertube, getVideoInfoFallback } from "@/lib/youtube";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // Try youtubei.js first (gives duration + description)
    try {
      const yt = await getInnertube();
      const info = await yt.getBasicInfo(videoId);
      const details = info.basic_info;

      return NextResponse.json({
        title: details.title || "",
        duration: details.duration || 0,
        thumbnail: details.thumbnail?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        description: details.short_description || "",
        channel: details.channel?.name || details.author || "",
        videoId,
      });
    } catch {
      // Fall back to oEmbed (always works, but no duration/description)
      const fallback = await getVideoInfoFallback(videoId);
      return NextResponse.json(fallback);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch video info";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
