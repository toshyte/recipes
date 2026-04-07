import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const exec = promisify(execFile);

export async function POST(req: NextRequest) {
  const { apiKey, url, title, description, duration, transcript } = await req.json();
  if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 });

  let tmpDir: string | null = null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Download a low-res version of the video for Gemini analysis
    tmpDir = await mkdtemp(join(tmpdir(), "recipe-video-"));
    const videoPath = join(tmpDir, "video.mp4");

    await exec("yt-dlp", [
      "-f", "worstvideo[ext=mp4]+worstaudio[ext=m4a]/worst[ext=mp4]/worst",
      "--merge-output-format", "mp4",
      "-o", videoPath,
      url,
    ], { timeout: 120000 });

    const videoBuffer = await readFile(videoPath);
    const videoBase64 = videoBuffer.toString("base64");

    // Clean up immediately
    await unlink(videoPath).catch(() => {});

    const transcriptText = transcript?.segments
      ?.map((s: { start: number; text: string }) => `[${s.start}s] ${s.text}`)
      .join("\n") || "";

    const prompt = `You are analyzing this cooking/recipe video to find the best moments for blog post screenshots.

Video: "${title}"
Duration: ${duration} seconds
Description: ${description || "N/A"}

${transcriptText ? `Transcript:\n${transcriptText.slice(0, 4000)}` : ""}

Watch the video carefully and suggest 6-8 timestamps (in seconds) that would make the best screenshots for a recipe blog post. Focus on:
1. The finished dish (hero shot) — the most appetizing moment
2. Key ingredient preparation moments (chopping, mixing, etc.)
3. Important cooking technique steps (searing, baking, etc.)
4. Before/after transformations
5. Plating or serving moments
6. Close-ups of textures, sauces, or garnishes

Return ONLY a JSON array of objects with "timestamp" (number) and "description" (string) fields.
Example: [{"timestamp": 45, "description": "Chopping fresh herbs"}, ...]`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "video/mp4", data: videoBase64 } },
            { text: prompt },
          ],
        },
      ],
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse suggestions" }, { status: 500 });
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to suggest timestamps";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
