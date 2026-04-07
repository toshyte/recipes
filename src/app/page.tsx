"use client";

import { useState, useCallback } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import ScreenshotGallery, { Screenshot } from "@/components/ScreenshotGallery";
import ImageEditor from "@/components/ImageEditor";
import GeminiPanel from "@/components/GeminiPanel";
import BlogPreview from "@/components/BlogPreview";
import CollageCreator from "@/components/CollageCreator";

interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  description: string;
  channel: string;
  videoId: string;
}

interface Suggestion {
  timestamp: number;
  description: string;
}

interface TranscriptData {
  segments: { start: number; text: string }[];
  description: string;
}

type Step = "input" | "capture" | "edit" | "blog";

export default function Home() {
  // Workflow state
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [seekTime, setSeekTime] = useState<number | undefined>();
  const [thumbnailGrid, setThumbnailGrid] = useState<{ timestamp: number; image: string }[]>([]);
  const [selectedThumbs, setSelectedThumbs] = useState<Record<number, number>>({});
  const [thumbPreviews, setThumbPreviews] = useState<Record<number, string>>({}); // originalTs -> preview image // original timestamp -> adjusted timestamp
  const [adjustingThumb, setAdjustingThumb] = useState<number | null>(null); // timestamp being fine-tuned
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [geminiId, setGeminiId] = useState<string | null>(null);
  const [showCollage, setShowCollage] = useState(false);
  const [blog, setBlog] = useState<{
    html: string;
    meta_title: string;
    meta_description: string;
    keywords: string;
  } | null>(null);
  const [showBlog, setShowBlog] = useState(false);
  const [error, setError] = useState("");

  // Load video
  const loadVideo = async () => {
    if (!url) return;
    setError("");
    setLoading("Loading video info...");

    try {
      const res = await fetch("/api/video-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVideoInfo(data);
      setScreenshots([]);
      setSuggestions([]);
      setTranscript(null);
      setBlog(null);
      setSeekTime(undefined);
      setThumbnailGrid([]);
      setSelectedThumbs({});
      setThumbPreviews({});
      setAdjustingThumb(null);
      setStreamUrl(null);
      setStep("capture");

      // Fetch stream URL and transcript in background
      fetch(`/api/video-stream?v=${data.videoId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.streamUrl) setStreamUrl(d.streamUrl);
        })
        .catch(() => {});

      fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) setTranscript(d);
        })
        .catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load video");
    } finally {
      setLoading("");
    }
  };

  // Client-side frame capture using hidden video + canvas
  const captureFrameFromVideo = useCallback(
    (timestamp: number): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (!streamUrl) {
          reject(new Error("Video stream not ready yet. Please wait a moment and try again."));
          return;
        }

        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.muted = true;

        const cleanup = () => {
          video.removeAttribute("src");
          video.load();
        };

        video.onloadedmetadata = () => {
          video.currentTime = timestamp;
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
            cleanup();
            resolve(dataUrl);
          } catch (e) {
            cleanup();
            reject(e);
          }
        };

        video.onerror = () => {
          cleanup();
          reject(new Error("Failed to load video for frame capture"));
        };

        // Timeout after 15s
        setTimeout(() => {
          cleanup();
          reject(new Error("Frame capture timed out"));
        }, 15000);

        video.src = streamUrl;
      });
    },
    [streamUrl]
  );

  // Extract frame
  const captureFrame = useCallback(
    async (timestamp: number) => {
      setLoading("Extracting frame...");
      try {
        const image = await captureFrameFromVideo(timestamp);

        const newShot: Screenshot = {
          id: `shot-${Date.now()}`,
          image,
          timestamp,
          description: "",
        };
        setScreenshots((prev) => [...prev, newShot]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to extract frame");
      } finally {
        setLoading("");
      }
    },
    [captureFrameFromVideo]
  );

  // AI suggest timestamps
  const suggestTimestamps = async () => {
    if (!apiKey) {
      setError("Enter your Gemini API key first");
      return;
    }
    setLoading("AI is analyzing the video...");
    try {
      const res = await fetch("/api/suggest-timestamps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          url,
          title: videoInfo?.title,
          description: videoInfo?.description,
          duration: videoInfo?.duration,
          transcript,
          thumbnails: thumbnailGrid.length > 0 ? thumbnailGrid : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuggestions(data.suggestions);

      // Auto-extend duration if suggestions exceed reported duration
      const maxSuggestionTime = Math.max(...data.suggestions.map((s: Suggestion) => s.timestamp));
      if (videoInfo && maxSuggestionTime > videoInfo.duration) {
        setVideoInfo({ ...videoInfo, duration: maxSuggestionTime + 30 });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to suggest timestamps");
    } finally {
      setLoading("");
    }
  };

  // Auto-capture all suggestions
  const captureAllSuggestions = async () => {
    for (const s of suggestions) {
      await captureFrame(s.timestamp);
    }
  };

  // Extract thumbnail grid client-side (every N seconds)
  const extractThumbnailGrid = async (interval = 1) => {
    if (!streamUrl || !videoInfo) {
      setError("Video stream not ready yet. Please wait a moment and try again.");
      return;
    }
    setLoading("Extracting frames (this may take a moment)...");
    setThumbnailGrid([]);
    setSelectedThumbs({});

    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.preload = "auto";
      video.muted = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
        setTimeout(() => reject(new Error("Video load timed out")), 30000);
        video.src = streamUrl;
      });

      const duration = video.duration || videoInfo.duration;
      const thumbnails: { timestamp: number; image: string }[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      for (let t = 0; t < duration; t += interval) {
        await new Promise<void>((resolve) => {
          video.onseeked = () => {
            canvas.width = Math.min(video.videoWidth, 320);
            canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
            thumbnails.push({ timestamp: t, image: dataUrl });
            setThumbnailGrid([...thumbnails]);
            resolve();
          };
          video.currentTime = t;
        });
      }

      video.removeAttribute("src");
      video.load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to extract thumbnails");
    } finally {
      setLoading("");
    }
  };

  // Toggle thumbnail selection
  const toggleThumb = (timestamp: number) => {
    setSelectedThumbs((prev) => {
      const next = { ...prev };
      if (timestamp in next) {
        delete next[timestamp];
        if (adjustingThumb === timestamp) setAdjustingThumb(null);
      } else {
        next[timestamp] = timestamp;
      }
      return next;
    });
  };

  // Adjust a selected thumbnail's capture timestamp and fetch new preview
  const adjustThumbTime = async (originalTs: number, delta: number) => {
    const current = selectedThumbs[originalTs] ?? originalTs;
    const newTs = Math.max(0, current + delta);
    setSelectedThumbs((prev) => ({ ...prev, [originalTs]: newTs }));

    // Capture preview for the adjusted timestamp client-side
    try {
      const image = await captureFrameFromVideo(newTs);
      setThumbPreviews((prev) => ({ ...prev, [originalTs]: image }));
    } catch {
      // Keep existing preview on failure
    }
  };

  const selectedCount = Object.keys(selectedThumbs).length;

  // Add selected thumbnails as HD screenshots (using adjusted timestamps)
  const captureSelectedThumbs = async () => {
    const timestamps = Object.values(selectedThumbs).sort((a, b) => a - b);
    for (const ts of timestamps) {
      await captureFrame(ts);
    }
    setSelectedThumbs({});
    setAdjustingThumb(null);
  };

  // Generate blog
  const generateBlog = async () => {
    if (!apiKey) {
      setError("Enter your Gemini API key first");
      return;
    }
    if (screenshots.length === 0) {
      setError("Capture some screenshots first");
      return;
    }
    setLoading("Generating blog post...");
    try {
      const res = await fetch("/api/gemini-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          title: videoInfo?.title,
          description: videoInfo?.description,
          transcript,
          screenshots: screenshots.map((s) => ({
            timestamp: s.timestamp,
            description: s.description,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBlog(data);
      setShowBlog(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate blog");
    } finally {
      setLoading("");
    }
  };

  // Export blog
  const exportBlog = (format: "html" | "markdown") => {
    if (!blog) return;

    let content = blog.html;

    // Replace image placeholders with actual images
    screenshots.forEach((shot, idx) => {
      const placeholder = `<!-- IMAGE_${idx + 1} -->`;
      if (format === "html") {
        content = content.replace(
          placeholder,
          `<figure><img src="${shot.image}" alt="${shot.description || `Step ${idx + 1}`}" /><figcaption>${shot.description || ""}</figcaption></figure>`
        );
      } else {
        content = content.replace(
          placeholder,
          `![${shot.description || `Step ${idx + 1}`}](image_${idx + 1}.jpg)\n*${shot.description || ""}*`
        );
      }
    });

    if (format === "html") {
      content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${blog.meta_title}</title>
  <meta name="description" content="${blog.meta_description}">
  <meta name="keywords" content="${blog.keywords}">
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.8; color: #333; }
    img { max-width: 100%; border-radius: 12px; }
    figure { margin: 2em 0; }
    figcaption { text-align: center; color: #888; font-size: 0.9em; margin-top: 0.5em; }
    h1 { font-size: 2.2em; }
    h2 { margin-top: 2em; color: #222; }
    .recipe-meta { background: #f9f9f9; padding: 1.5em; border-radius: 12px; margin: 1.5em 0; }
    .pro-tips { background: #fff8e1; padding: 1.5em; border-radius: 12px; margin: 1.5em 0; border-left: 4px solid #f97316; }
    .recipe-card { border: 2px solid #f97316; border-radius: 16px; padding: 2em; margin: 2em 0; background: #fafafa; }
    .recipe-card h2, .recipe-card h3 { color: #d4650a; }
    @media print { .recipe-card { break-inside: avoid; border-color: #333; } }
  </style>
</head>
<body>
${content}
</body>
</html>`;
    }

    const blob = new Blob([content], {
      type: format === "html" ? "text/html" : "text/markdown",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `recipe-blog.${format === "html" ? "html" : "md"}`;
    a.click();
  };

  // Image editor callbacks
  const editingShot = editingId ? screenshots.find((s) => s.id === editingId) : null;
  const geminiShot = geminiId ? screenshots.find((s) => s.id === geminiId) : null;

  const steps: { key: Step; label: string; num: number }[] = [
    { key: "input", label: "Video URL", num: 1 },
    { key: "capture", label: "Capture Frames", num: 2 },
    { key: "edit", label: "Edit & Enhance", num: 3 },
    { key: "blog", label: "Generate Blog", num: 4 },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              Recipe Video → Blog
            </h1>
            <p className="text-xs text-[var(--muted)]">
              Turn YouTube cooking videos into beautiful blog posts
            </p>
          </div>

          {/* API Key */}
          <div className="flex items-center gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Gemini API Key"
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm w-56 focus:border-[var(--accent)] outline-none"
            />
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b border-[var(--border)] px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-1">
          {steps.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                if (s.key === "input" || videoInfo) setStep(s.key);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                step === s.key
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--card)]"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.key ? "bg-white/20" : "bg-[var(--border)]"
                }`}
              >
                {s.num}
              </span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="px-6 py-3 bg-[var(--accent)]/10 border-b border-[var(--accent)]/20">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--accent)]">{loading}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-sm text-red-400">{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-300 cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Step 1: Video Input */}
        {step === "input" && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Paste a YouTube Recipe Video</h2>
              <p className="text-[var(--muted)]">
                The app will extract frames, analyze the recipe, and generate a blog post for you.
              </p>
            </div>

            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadVideo()}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-base focus:border-[var(--accent)] outline-none"
              />
              <button
                onClick={loadVideo}
                disabled={!url || !!loading}
                className="px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
              >
                Load Video
              </button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              {[
                { icon: "📸", title: "Smart Capture", desc: "AI suggests the best moments to screenshot" },
                { icon: "🎨", title: "Built-in Editor", desc: "Crop, resize, adjust — no Photoshop needed" },
                { icon: "📝", title: "Auto Blog", desc: "Full recipe blog post generated from video" },
              ].map((f) => (
                <div key={f.title} className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)]">
                  <div className="text-3xl mb-2">{f.icon}</div>
                  <h3 className="font-medium mb-1">{f.title}</h3>
                  <p className="text-xs text-[var(--muted)]">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Capture Frames */}
        {step === "capture" && videoInfo && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Video player */}
              <div className="lg:col-span-2">
                <VideoPlayer
                  videoId={videoInfo.videoId}
                  videoUrl={url}
                  thumbnail={videoInfo.thumbnail}
                  duration={videoInfo.duration}
                  onTimestampSelect={captureFrame}
                  currentTime={seekTime}
                />
                <div className="mt-3 bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                  <h3 className="font-medium text-sm mb-1">{videoInfo.title}</h3>
                  <p className="text-xs text-[var(--muted)]">{videoInfo.channel}</p>
                </div>
              </div>

              {/* AI Suggestions panel */}
              <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] h-fit">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span>AI Timestamp Suggestions</span>
                </h3>

                {suggestions.length === 0 ? (
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-3">
                      Let Gemini analyze the video transcript and suggest the best moments to capture.
                    </p>
                    <button
                      onClick={suggestTimestamps}
                      disabled={!!loading || !apiKey}
                      className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:brightness-110 transition-all cursor-pointer"
                    >
                      {!apiKey ? "Enter API Key First" : "Suggest Timestamps"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSeekTime(s.timestamp);
                          }}
                          className="w-full text-left flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--bg)] transition-colors cursor-pointer"
                        >
                          <span className="text-xs font-mono text-[var(--accent)] mt-0.5 shrink-0">
                            {Math.floor(s.timestamp / 60)}:
                            {(s.timestamp % 60).toString().padStart(2, "0")}
                          </span>
                          <span className="text-xs">{s.description}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={captureAllSuggestions}
                      disabled={!!loading}
                      className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:brightness-110 transition-all cursor-pointer"
                    >
                      Capture All Suggestions
                    </button>
                  </div>
                )}

                {/* Manual timestamp input */}
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <h4 className="text-xs text-[var(--muted)] mb-2">Manual Capture</h4>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max={videoInfo.duration}
                      placeholder="Seconds"
                      className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = Number((e.target as HTMLInputElement).value);
                          if (val >= 0) captureFrame(val);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = (e.target as HTMLElement)
                          .parentElement?.querySelector("input") as HTMLInputElement;
                        if (input?.value) captureFrame(Number(input.value));
                      }}
                      disabled={!!loading}
                      className="px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm disabled:opacity-50 cursor-pointer"
                    >
                      Grab
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium">Visual Frame Picker</h3>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Browse all frames — click to select, then fine-tune each one before capturing in HD
                  </p>
                </div>
                <button
                  onClick={() => extractThumbnailGrid(1)}
                  disabled={!!loading}
                  className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg font-medium hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading && loading.includes("frames") ? "Extracting..." : thumbnailGrid.length > 0 ? "Refresh Frames" : "Extract All Frames"}
                </button>
              </div>

              {thumbnailGrid.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto p-1">
                    {thumbnailGrid.map((thumb) => {
                      const isSelected = thumb.timestamp in selectedThumbs;
                      const isAdjusting = adjustingThumb === thumb.timestamp;
                      const adjustedTs = selectedThumbs[thumb.timestamp] ?? thumb.timestamp;
                      const fmtTs = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;

                      return (
                        <div key={thumb.timestamp} className="relative group">
                          <button
                            onClick={() => toggleThumb(thumb.timestamp)}
                            className={`relative w-full aspect-video rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                              isSelected
                                ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                                : "border-transparent hover:border-[var(--border)]"
                            }`}
                          >
                            <img
                              src={thumbPreviews[thumb.timestamp] || thumb.image}
                              alt={`Frame at ${fmtTs(adjustedTs)}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center py-0.5 font-mono">
                              {fmtTs(adjustedTs)}
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-5 h-5 bg-[var(--accent)] rounded-full flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </div>
                            )}
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setThumbnailGrid((prev) => prev.filter((t) => t.timestamp !== thumb.timestamp));
                              if (thumb.timestamp in selectedThumbs) {
                                setSelectedThumbs((prev) => {
                                  const next = { ...prev };
                                  delete next[thumb.timestamp];
                                  return next;
                                });
                              }
                            }}
                            className="absolute top-1 left-1 w-5 h-5 bg-red-600/80 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>

                          {/* Fine-tune button */}
                          {isSelected && (
                            <button
                              onClick={() => setAdjustingThumb(isAdjusting ? null : thumb.timestamp)}
                              className="mt-1 w-full text-[10px] text-center text-[var(--accent)] hover:underline cursor-pointer"
                            >
                              {isAdjusting ? "Close" : `Fine-tune (${fmtTs(adjustedTs)})`}
                            </button>
                          )}

                          {/* Fine-tune controls */}
                          {isAdjusting && (
                            <div className="mt-1 bg-[var(--bg)] rounded-lg p-2 border border-[var(--border)]">
                              <div className="text-[10px] text-center text-[var(--muted)] mb-1">
                                Capture at: <span className="text-[var(--accent)] font-mono">{fmtTs(adjustedTs)}</span>
                              </div>
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => adjustThumbTime(thumb.timestamp, -1)}
                                  className="px-2 py-1 text-xs bg-[var(--card)] border border-[var(--border)] rounded hover:border-[var(--accent)] cursor-pointer"
                                >
                                  ← -1s
                                </button>
                                <button
                                  onClick={() => adjustThumbTime(thumb.timestamp, 1)}
                                  className="px-2 py-1 text-xs bg-[var(--card)] border border-[var(--border)] rounded hover:border-[var(--accent)] cursor-pointer"
                                >
                                  +1s →
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {selectedCount > 0 && (
                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-[var(--border)]">
                      <span className="text-sm text-[var(--muted)]">
                        {selectedCount} frame{selectedCount > 1 ? "s" : ""} selected
                      </span>
                      <button
                        onClick={captureSelectedThumbs}
                        disabled={!!loading}
                        className="px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Capture {selectedCount} Frame{selectedCount > 1 ? "s" : ""} in HD
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-[var(--muted)] text-center py-8">
                  Click &quot;Extract All Frames&quot; to see every 10 seconds of the video at a glance
                </p>
              )}
            </div>

            {/* Screenshots */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">
                  Captured Screenshots ({screenshots.length})
                </h3>
                {screenshots.length >= 2 && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep("edit")}
                      className="px-4 py-2 text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                    >
                      Edit Images →
                    </button>
                    <button
                      onClick={generateBlog}
                      disabled={!!loading}
                      className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Generate Blog →
                    </button>
                  </div>
                )}
              </div>

              <ScreenshotGallery
                screenshots={screenshots}
                onRemove={(id) => setScreenshots((prev) => prev.filter((s) => s.id !== id))}
                onEdit={(id) => setEditingId(id)}
                onReorder={setScreenshots}
                onDescriptionChange={(id, desc) =>
                  setScreenshots((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, description: desc } : s))
                  )
                }
              />
            </div>
          </div>
        )}

        {/* Step 3: Edit & Enhance */}
        {step === "edit" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Edit & Enhance</h2>
                <p className="text-sm text-[var(--muted)]">
                  Click Edit to resize/crop, or AI to enhance with Gemini
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("capture")}
                  className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setShowCollage(true)}
                  disabled={screenshots.length < 2}
                  className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Create Collage
                </button>
                <button
                  onClick={generateBlog}
                  disabled={!!loading || screenshots.length === 0}
                  className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
                >
                  Generate Blog →
                </button>
              </div>
            </div>

            {/* Batch resize */}
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <h3 className="font-medium mb-3">Batch Resize All Images</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Blog Wide (1200×675)", w: 1200, h: 675 },
                  { label: "Blog Square (800×800)", w: 800, h: 800 },
                  { label: "Pinterest (735×1102)", w: 735, h: 1102 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setScreenshots((prev) =>
                        prev.map((shot) => {
                          const canvas = document.createElement("canvas");
                          canvas.width = preset.w;
                          canvas.height = preset.h;
                          const ctx = canvas.getContext("2d")!;
                          const img = new Image();
                          // Always crop from the original to avoid quality loss
                          const srcImage = shot.originalImage || shot.image;
                          img.src = srcImage;
                          // Cover-crop: scale to fill, then center-crop
                          const scale = Math.max(preset.w / img.naturalWidth, preset.h / img.naturalHeight);
                          const sw = preset.w / scale;
                          const sh = preset.h / scale;
                          const sx = (img.naturalWidth - sw) / 2;
                          const sy = (img.naturalHeight - sh) / 2;
                          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, preset.w, preset.h);
                          return {
                            ...shot,
                            originalImage: srcImage,
                            image: canvas.toDataURL("image/jpeg", 0.92),
                            edited: true,
                            cropPreset: { w: preset.w, h: preset.h },
                          };
                        })
                      );
                    }}
                    className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <ScreenshotGallery
              screenshots={screenshots}
              onRemove={(id) => setScreenshots((prev) => prev.filter((s) => s.id !== id))}
              onEdit={(id) => setEditingId(id)}
              onReorder={setScreenshots}
              onDescriptionChange={(id, desc) =>
                setScreenshots((prev) =>
                  prev.map((s) => (s.id === id ? { ...s, description: desc } : s))
                )
              }
            />

            {/* AI Enhancement section */}
            {apiKey && screenshots.length > 0 && (
              <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
                <h3 className="font-medium mb-3">Gemini AI Analysis</h3>
                <p className="text-sm text-[var(--muted)] mb-3">
                  Click on any screenshot above and select &quot;Edit&quot; for the image editor, or use the buttons below for AI analysis.
                </p>
                <div className="flex flex-wrap gap-2">
                  {screenshots.map((shot, idx) => (
                    <button
                      key={shot.id}
                      onClick={() => setGeminiId(shot.id)}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                    >
                      <img
                        src={shot.image}
                        alt=""
                        className="w-8 h-8 rounded object-cover"
                      />
                      AI Analyze #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Blog */}
        {step === "blog" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Generate Blog Post</h2>
                <p className="text-sm text-[var(--muted)]">
                  AI will analyze the video and your screenshots to write a complete recipe blog post.
                </p>
              </div>
              <button
                onClick={() => setStep("edit")}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                ← Back to Edit
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Video", value: videoInfo?.title || "—" },
                { label: "Screenshots", value: `${screenshots.length} captured` },
                { label: "Transcript", value: transcript?.segments?.length ? `${transcript.segments.length} segments` : "Not available" },
                { label: "API Key", value: apiKey ? "Configured" : "Missing" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]"
                >
                  <div className="text-xs text-[var(--muted)] mb-1">{item.label}</div>
                  <div className="text-sm font-medium truncate">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Preview grid */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {screenshots.map((shot, idx) => (
                <img
                  key={shot.id}
                  src={shot.image}
                  alt={`Screenshot ${idx + 1}`}
                  className="w-32 h-20 object-cover rounded-lg border border-[var(--border)] shrink-0"
                />
              ))}
            </div>

            <button
              onClick={generateBlog}
              disabled={!!loading || !apiKey || screenshots.length === 0}
              className="w-full py-4 bg-[var(--accent)] text-white rounded-xl text-lg font-bold hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? loading : "Generate Recipe Blog Post"}
            </button>

            {blog && (
              <button
                onClick={() => setShowBlog(true)}
                className="w-full py-3 border border-[var(--accent)] text-[var(--accent)] rounded-xl text-sm font-medium hover:bg-[var(--accent)]/10 transition-colors cursor-pointer"
              >
                View Generated Blog Post
              </button>
            )}
          </div>
        )}
      </main>

      {/* Image Editor Modal */}
      {editingShot && (
        <ImageEditor
          image={editingShot.image}
          originalImage={editingShot.originalImage}
          cropPreset={editingShot.cropPreset}
          onSave={(editedImage) => {
            setScreenshots((prev) =>
              prev.map((s) =>
                s.id === editingId
                  ? { ...s, image: editedImage, originalImage: s.originalImage || s.image, edited: true }
                  : s
              )
            );
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Gemini Panel Modal */}
      {geminiShot && apiKey && (
        <GeminiPanel
          image={geminiShot.image}
          apiKey={apiKey}
          onResult={(text) => {
            // Auto-set description if empty
            if (!geminiShot.description) {
              setScreenshots((prev) =>
                prev.map((s) =>
                  s.id === geminiId
                    ? { ...s, description: text.slice(0, 100) }
                    : s
                )
              );
            }
          }}
          onClose={() => setGeminiId(null)}
        />
      )}

      {/* Blog Preview Modal */}
      {showBlog && blog && (
        <BlogPreview
          html={blog.html}
          screenshots={screenshots}
          metaTitle={blog.meta_title}
          metaDescription={blog.meta_description}
          keywords={blog.keywords}
          onClose={() => setShowBlog(false)}
          onExport={exportBlog}
        />
      )}

      {/* Collage Creator Modal */}
      {showCollage && (
        <CollageCreator
          screenshots={screenshots}
          onSave={(collageImage) => {
            const newShot: Screenshot = {
              id: `collage-${Date.now()}`,
              image: collageImage,
              timestamp: 0,
              description: "Collage",
              edited: true,
            };
            setScreenshots((prev) => [...prev, newShot]);
            setShowCollage(false);
          }}
          onCancel={() => setShowCollage(false)}
        />
      )}
    </div>
  );
}
