import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  const { apiKey, title, description, transcript, screenshots } = await req.json();
  if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 });

  try {
    const ai = new GoogleGenAI({ apiKey });

    const transcriptText = transcript?.segments
      ?.map((s: { start: number; text: string }) => `[${s.start}s] ${s.text}`)
      .join("\n") || "";

    const screenshotDescriptions = screenshots
      ?.map((s: { timestamp: number; description?: string }, i: number) =>
        `Image ${i + 1} (at ${s.timestamp}s): ${s.description || "Recipe step"}`)
      .join("\n") || "";

    // Step 1: Generate the HTML blog post
    const htmlPrompt = `You are a professional food blogger with your own unique voice. You are writing an ORIGINAL blog post inspired by a recipe you learned from a video.

REFERENCE MATERIAL (use for recipe accuracy only — do NOT copy or paraphrase):
- Video: "${title}"
- Description: ${description || "N/A"}
- Transcript: ${transcriptText.slice(0, 12000)}
- Screenshots: ${screenshotDescriptions}

CRITICAL RULES:
1. Write in YOUR OWN WORDS. Do NOT rewrite, summarize, or paraphrase the transcript. The transcript is ONLY a reference for accurate ingredients and measurements.
2. Write as if YOU made this dish and are sharing your personal experience. Use first person ("I", "my").
3. Add your own insights: why you love this recipe, what surprised you, what you'd do differently next time, what it pairs well with.
4. Add sensory descriptions: how it smells while cooking, the sounds of sizzling, the texture, the first bite.
5. Include helpful context the transcript doesn't have: origin of the dish, variations across regions, ingredient substitutions, common mistakes to avoid.
6. The tone should be warm, conversational, and enthusiastic — like talking to a friend, not reading instructions.

STRUCTURE (HTML format):
1. Creative, SEO-friendly title (h1) — NOT the video title, write your own
2. Engaging intro (3-4 sentences) — a personal story or hook about why this recipe matters to you
3. "Why This Recipe Works" section — 3-4 bullet points about what makes it special
4. Recipe overview (prep time, cook time, servings, difficulty)
5. Ingredients list with exact measurements (from transcript) + your notes on substitutions
6. Step-by-step instructions written in your own words with <!-- IMAGE_N --> placeholders where images fit naturally
7. "Tips & Tricks" section — your personal advice, not from the transcript
8. "Serving Suggestions" — what to pair it with, how to plate it
9. "Storage & Leftovers" — practical advice
10. Brief outro with a call to action
11. RECIPE CARD at the bottom — a clean, printable summary with: name, times, servings, ingredients, condensed steps

HTML conventions:
- Wrap in <article>
- Use semantic HTML (h1, h2, h3, ul, ol, p)
- class="recipe-meta" for overview
- class="ingredients" for ingredients
- class="instructions" for steps
- class="pro-tips" for tips
- class="recipe-card" for the card (styled with border, padding, background)
- <!-- IMAGE_N --> placeholders (1-indexed)

Return ONLY raw HTML. No markdown fences, no JSON.`;

    const htmlResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: htmlPrompt,
    });

    const html = (htmlResponse.text || "").replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim();

    // Step 2: Generate meta info (small, reliable JSON)
    const metaPrompt = `Given this recipe blog post title: "${title}"

Generate SEO metadata. Return ONLY a JSON object with exactly these 3 fields:
- "meta_title": SEO title, max 60 chars
- "meta_description": meta description, max 155 chars
- "keywords": comma-separated keywords

Example: {"meta_title":"Easy Pork Wellington Recipe","meta_description":"Learn how to make a stunning pork wellington with flaky pastry and juicy tenderloin. Simple steps for an impressive dinner.","keywords":"pork wellington, pastry recipe, dinner ideas"}`;

    const metaResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: metaPrompt,
    });

    const metaText = (metaResponse.text || "").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    let meta = { meta_title: title, meta_description: "", keywords: "" };
    try {
      const parsed = JSON.parse(metaText);
      meta = { ...meta, ...parsed };
    } catch {
      // Use defaults if meta parsing fails
    }

    return NextResponse.json({
      html,
      meta_title: meta.meta_title,
      meta_description: meta.meta_description,
      keywords: meta.keywords,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to generate blog";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
