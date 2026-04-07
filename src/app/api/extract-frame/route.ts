import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

const exec = promisify(execFile);

export async function POST(req: NextRequest) {
  const { url, timestamp } = await req.json();
  if (!url || timestamp === undefined) {
    return NextResponse.json({ error: "URL and timestamp required" }, { status: 400 });
  }

  let dir: string | null = null;

  try {
    dir = await mkdtemp(join(tmpdir(), "recipe-frame-"));
    const outPath = join(dir, "frame.jpg");

    // Get the best direct video URL
    const { stdout: videoUrl } = await exec("yt-dlp", [
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "-g",
      url,
    ]);

    const directUrl = videoUrl.trim().split("\n")[0];

    // Seek a few seconds before for keyframe, then precise-seek to exact timestamp
    // This avoids black frames from fast-seeking past keyframes
    const coarseSeek = Math.max(0, timestamp - 5);
    const fineSeek = timestamp - coarseSeek;

    await exec("ffmpeg", [
      "-ss", String(coarseSeek),    // fast seek to nearby keyframe
      "-i", directUrl,
      "-ss", String(fineSeek),       // precise seek from there
      "-vframes", "1",
      "-q:v", "2",
      "-y",
      outPath,
    ], { timeout: 30000 });

    // Check if frame was extracted and is not too small (black frames are tiny)
    if (!existsSync(outPath)) {
      // Retry without fine seek
      await exec("ffmpeg", [
        "-ss", String(timestamp),
        "-i", directUrl,
        "-vframes", "1",
        "-q:v", "2",
        "-y",
        outPath,
      ], { timeout: 30000 });
    }

    const imageBuffer = await readFile(outPath);

    // If file is suspiciously small (<5KB), it's likely a black frame — try +2s
    if (imageBuffer.length < 5000) {
      const retryPath = join(dir, "frame_retry.jpg");
      await exec("ffmpeg", [
        "-ss", String(timestamp + 2),
        "-i", directUrl,
        "-vframes", "1",
        "-q:v", "2",
        "-y",
        retryPath,
      ], { timeout: 30000 });

      if (existsSync(retryPath)) {
        const retryBuffer = await readFile(retryPath);
        if (retryBuffer.length > imageBuffer.length) {
          const base64 = retryBuffer.toString("base64");
          await unlink(outPath).catch(() => {});
          await unlink(retryPath).catch(() => {});
          return NextResponse.json({
            image: `data:image/jpeg;base64,${base64}`,
            timestamp: timestamp + 2,
          });
        }
        await unlink(retryPath).catch(() => {});
      }
    }

    const base64 = imageBuffer.toString("base64");
    await unlink(outPath).catch(() => {});

    return NextResponse.json({
      image: `data:image/jpeg;base64,${base64}`,
      timestamp,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to extract frame";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
