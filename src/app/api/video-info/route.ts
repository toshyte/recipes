import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    const { stdout } = await exec("/opt/homebrew/bin/yt-dlp", [
      "--dump-json",
      "--no-download",
      url,
    ]);

    const info = JSON.parse(stdout);

    // duration can sometimes be missing or wrong — try multiple sources
    let duration = info.duration;
    if (!duration && info.duration_string) {
      // Parse "MM:SS" or "HH:MM:SS"
      const parts = info.duration_string.split(":").map(Number);
      if (parts.length === 2) duration = parts[0] * 60 + parts[1];
      if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return NextResponse.json({
      title: info.title,
      duration: Math.ceil(duration || 0),
      thumbnail: info.thumbnail,
      description: info.description,
      channel: info.channel,
      videoId: info.id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to fetch video info";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
