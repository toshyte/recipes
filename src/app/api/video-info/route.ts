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

    // Try youtubei.js first (gives duration + description + storyboard)
    try {
      const yt = await getInnertube();
      const info = await yt.getBasicInfo(videoId);
      const details = info.basic_info;

      // Extract storyboard spec for thumbnail grid
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storyboard = (info as any).storyboards?.type === "PlayerStoryboardSpec"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (info as any).storyboards
        : null;

      // Also try to get streaming URL
      let streamUrl: string | null = null;
      const format = info.streaming_data?.formats
        ?.filter((f) => f.mime_type?.includes("video/mp4") && f.has_video && f.has_audio)
        ?.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0];
      if (format?.url) {
        streamUrl = format.url;
      } else {
        const adaptive = info.streaming_data?.adaptive_formats
          ?.filter((f) => f.mime_type?.includes("video/mp4") && f.has_video)
          ?.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0];
        if (adaptive?.url) streamUrl = adaptive.url;
      }

      return NextResponse.json({
        title: details.title || "",
        duration: details.duration || 0,
        thumbnail: details.thumbnail?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        description: details.short_description || "",
        channel: details.channel?.name || details.author || "",
        videoId,
        streamUrl,
        storyboardSpec: storyboard?.template || null,
      });
    } catch {
      // Fall back to oEmbed
      const fallback = await getVideoInfoFallback(videoId);
      return NextResponse.json(fallback);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch video info";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
