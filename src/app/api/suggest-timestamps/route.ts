import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { apiKey, url, title, description, duration, transcript, thumbnails } = await req.json();
  if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 });

  try {
    const ai = new GoogleGenAI({ apiKey });

    const transcriptText = transcript?.segments
      ?.map((s: { start: number; text: string }) => `[${s.start}s] ${s.text}`)
      .join("\n") || "";

    // Build parts array - include thumbnail images if available for visual context
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // Add some thumbnails for visual context (first, middle, last)
    if (thumbnails && thumbnails.length > 0) {
      const indices = [
        0,
        Math.floor(thumbnails.length * 0.25),
        Math.floor(thumbnails.length * 0.5),
        Math.floor(thumbnails.length * 0.75),
        thumbnails.length - 1,
      ];
      const unique = [...new Set(indices)].filter((i) => i < thumbnails.length);

      for (const idx of unique) {
        const thumb = thumbnails[idx];
        if (thumb?.image) {
          const base64 = thumb.image.replace(/^data:image\/\w+;base64,/, "");
          parts.push({
            inlineData: { mimeType: "image/jpeg", data: base64 },
          });
          parts.push({ text: `[Frame at ${thumb.timestamp}s]` });
        }
      }
    }

    const prompt = `You are analyzing a cooking/recipe video to find the best moments for blog post screenshots.

Video: "${title}"
Duration: ${duration} seconds
Description: ${description || "N/A"}

${transcriptText ? `Transcript:\n${transcriptText.slice(0, 4000)}` : ""}

${thumbnails?.length ? `I've included ${thumbnails.length} sample frames from the video above for visual context.` : ""}

Suggest 6-8 timestamps (in seconds) that would make the best screenshots for a recipe blog post. Focus on:
1. The finished dish (hero shot) — the most appetizing moment
2. Key ingredient preparation moments (chopping, mixing, etc.)
3. Important cooking technique steps (searing, baking, etc.)
4. Before/after transformations
5. Plating or serving moments
6. Close-ups of textures, sauces, or garnishes

Return ONLY a JSON array of objects with "timestamp" (number) and "description" (string) fields.
Example: [{"timestamp": 45, "description": "Chopping fresh herbs"}, ...]`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts }],
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
