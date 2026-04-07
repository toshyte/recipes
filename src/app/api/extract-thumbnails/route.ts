import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, readdir, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const exec = promisify(execFile);

export async function POST(req: NextRequest) {
  const { url, interval = 1 } = await req.json();
  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  let dir: string | null = null;

  try {
    dir = await mkdtemp(join(tmpdir(), "recipe-thumbs-"));
    const videoPath = join(dir, "video.mp4");

    // Step 1: Download a tiny version (lowest quality, small file)
    await exec("yt-dlp", [
      "-f", "worstvideo[ext=mp4]/worst[ext=mp4]/worst",
      "--no-audio",
      "-o", videoPath,
      url,
    ], { timeout: 120000 });

    // Step 2: Extract frames every N seconds from local file
    await exec("ffmpeg", [
      "-i", videoPath,
      "-vf", `fps=1/${interval},scale=320:-1`,
      "-q:v", "5",
      "-y",
      join(dir, "thumb_%04d.jpg"),
    ], { timeout: 120000 });

    // Step 3: Read all thumbnails
    const files = (await readdir(dir))
      .filter(f => f.startsWith("thumb_"))
      .sort();

    const thumbnails: { timestamp: number; image: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const buffer = await readFile(join(dir, files[i]));
      if (buffer.length < 1500) continue; // skip black frames
      thumbnails.push({
        timestamp: i * interval,
        image: `data:image/jpeg;base64,${buffer.toString("base64")}`,
      });
    }

    // Cleanup
    await rm(dir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({ thumbnails });
  } catch (e: unknown) {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    const msg = e instanceof Error ? e.message : "Failed to extract thumbnails";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
