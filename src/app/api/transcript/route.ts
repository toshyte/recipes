import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    // Try to get auto-generated or manual subtitles
    const { stdout } = await exec("yt-dlp", [
      "--write-auto-sub",
      "--sub-lang", "en",
      "--skip-download",
      "--print-json",
      "--sub-format", "json3",
      "-o", "-",
      url,
    ], { maxBuffer: 10 * 1024 * 1024 });

    const info = JSON.parse(stdout);

    // Check for subtitle file references
    const subtitleUrl =
      info.requested_subtitles?.en?.url ||
      info.automatic_captions?.en?.[0]?.url;

    if (subtitleUrl) {
      // Fetch the subtitle content
      const subRes = await fetch(subtitleUrl);
      const subData = await subRes.json();

      // Parse json3 format into timestamped transcript
      const segments: { start: number; text: string }[] = [];
      if (subData.events) {
        for (const event of subData.events) {
          if (event.segs) {
            const text = event.segs.map((s: { utf8?: string }) => s.utf8 || "").join("").trim();
            if (text) {
              segments.push({
                start: Math.floor((event.tStartMs || 0) / 1000),
                text,
              });
            }
          }
        }
      }

      return NextResponse.json({ segments, description: info.description });
    }

    // Fallback: just return the description
    return NextResponse.json({
      segments: [],
      description: info.description || "No transcript available",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to get transcript";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
