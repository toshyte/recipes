import { NextRequest, NextResponse } from "next/server";
import { Innertube } from "youtubei.js";

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("v");
  if (!videoId) {
    return NextResponse.json({ error: "Video ID required" }, { status: 400 });
  }

  try {
    const yt = await Innertube.create();
    const info = await yt.getBasicInfo(videoId);

    // Get streaming URL - prefer mp4 format
    const format = info.streaming_data?.formats
      ?.filter((f) => f.mime_type?.includes("video/mp4") && f.has_video && f.has_audio)
      ?.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0]; // lowest quality for speed

    if (!format?.url) {
      // Try adaptive formats
      const adaptiveVideo = info.streaming_data?.adaptive_formats
        ?.filter((f) => f.mime_type?.includes("video/mp4") && f.has_video)
        ?.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0];

      if (!adaptiveVideo?.url) {
        return NextResponse.json({ error: "No streamable format found" }, { status: 404 });
      }

      // Return the direct URL for the client to use
      return NextResponse.json({ streamUrl: adaptiveVideo.url, hasAudio: false });
    }

    return NextResponse.json({ streamUrl: format.url, hasAudio: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to get stream";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
