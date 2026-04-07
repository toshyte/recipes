import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, getInnertube } from "@/lib/youtube";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);

    try {
      const transcriptData = await info.getTranscript();
      const body = transcriptData?.transcript?.content;

      if (body && "body" in body) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const initialSegments = (body as any)?.body?.initial_segments;
        if (Array.isArray(initialSegments)) {
          const segments: { start: number; text: string }[] = [];

          for (const seg of initialSegments) {
            const startMs = seg?.start_ms ?? seg?.start_time_text ?? 0;
            const text = seg?.snippet?.text ?? seg?.text ?? "";
            if (text) {
              segments.push({
                start: Math.floor(Number(startMs) / 1000),
                text: String(text).trim(),
              });
            }
          }

          if (segments.length > 0) {
            return NextResponse.json({
              segments,
              description: info.basic_info.short_description || "",
            });
          }
        }
      }
    } catch {
      // Transcript not available
    }

    return NextResponse.json({
      segments: [],
      description: info.basic_info.short_description || "No transcript available",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to get transcript";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
