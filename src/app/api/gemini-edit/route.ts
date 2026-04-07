import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { apiKey, image, prompt } = await req.json();
  if (!apiKey || !image) {
    return NextResponse.json({ error: "API key and image required" }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Strip the data:image/...;base64, prefix
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = image.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";

    const editPrompt = prompt ||
      "Enhance this food photo: make the colors more vibrant, improve the lighting, and make the food look more appetizing. Keep it photorealistic.";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: editPrompt },
          ],
        },
      ],
    });

    const text = response.text || "";
    return NextResponse.json({ result: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to edit image";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
