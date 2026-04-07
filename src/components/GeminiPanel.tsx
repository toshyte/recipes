"use client";

import { useState } from "react";

interface GeminiPanelProps {
  image: string;
  apiKey: string;
  onResult: (text: string) => void;
  onClose: () => void;
}

const PRESETS = [
  {
    label: "Enhance Food Photo",
    prompt: "Describe how to make this food photo look more appetizing. Suggest specific edits for color correction, lighting, and composition improvements.",
  },
  {
    label: "Write Caption",
    prompt: "Write a short, engaging caption for this food image suitable for a blog post. Include sensory descriptions.",
  },
  {
    label: "Identify Ingredients",
    prompt: "List all visible ingredients in this food image. Be specific about quantities if possible.",
  },
  {
    label: "Suggest Styling",
    prompt: "Suggest food styling improvements for this photo. What props, garnishes, or plating changes would make it look more professional?",
  },
  {
    label: "Generate Alt Text",
    prompt: "Write SEO-optimized alt text for this food image. Be descriptive but concise (under 125 characters).",
  },
];

export default function GeminiPanel({ image, apiKey, onResult, onClose }: GeminiPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleSubmit = async (customPrompt?: string) => {
    const p = customPrompt || prompt;
    if (!p) return;

    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/gemini-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, image, prompt: p }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
      onResult(data.result);
    } catch (e: unknown) {
      setResult(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-2xl">✨</span> Gemini AI Analysis
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-white transition-colors text-xl cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Image */}
          <div className="w-1/2 p-6 border-r border-[var(--border)]">
            <img
              src={image}
              alt="Selected screenshot"
              className="w-full rounded-xl"
            />
          </div>

          {/* Right: Controls & Results */}
          <div className="w-1/2 p-6 flex flex-col gap-4 overflow-y-auto">
            {/* Presets */}
            <div>
              <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleSubmit(p.prompt)}
                    disabled={loading}
                    className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div>
              <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Custom Prompt</h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask Gemini anything about this image..."
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 text-sm resize-none h-24 focus:border-[var(--accent)] outline-none"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={loading || !prompt}
                className="mt-2 w-full py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:brightness-110 transition-all cursor-pointer"
              >
                {loading ? "Analyzing..." : "Send to Gemini"}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div className="flex-1">
                <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Result</h3>
                <div className="bg-[var(--bg)] rounded-xl p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {result}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
