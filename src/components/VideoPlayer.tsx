"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface VideoPlayerProps {
  videoId: string;
  videoUrl: string;
  thumbnail: string;
  duration: number;
  onTimestampSelect: (seconds: number) => void;
  currentTime?: number;
}

export default function VideoPlayer({
  videoId,
  videoUrl,
  thumbnail,
  duration,
  onTimestampSelect,
  currentTime,
}: VideoPlayerProps) {
  const [time, setTime] = useState(currentTime ?? 0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when parent changes currentTime (e.g. clicking a suggestion)
  useEffect(() => {
    if (currentTime !== undefined) {
      setTime(currentTime);
      fetchPreview(currentTime);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  // Fetch frame preview when time changes (debounced)
  const fetchPreview = useCallback(
    (t: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setLoadingPreview(true);
        try {
          const res = await fetch("/api/extract-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: videoUrl, timestamp: Math.floor(t) }),
          });
          const data = await res.json();
          if (data.image) {
            setPreviewImage(data.image);
          }
        } catch {
          // Silently fail — thumbnail stays visible
        } finally {
          setLoadingPreview(false);
        }
      }, 600);
    },
    [videoUrl]
  );

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const thumbUrl =
    thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const displayImage = previewImage || thumbUrl;

  return (
    <div className="relative">
      {/* Frame preview */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
        <img
          src={displayImage}
          alt="Video frame preview"
          className="w-full h-full object-cover"
        />

        {/* Loading overlay */}
        {loadingPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* YouTube link */}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(time)}s`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-3 flex items-center gap-2 bg-red-600/90 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch on YouTube
        </a>

        {/* Time badge */}
        <div className="absolute top-3 right-3 bg-black/80 text-white text-sm px-3 py-1.5 rounded-lg font-mono">
          {formatTime(time)} / {formatTime(duration)}
        </div>

        {/* Preview indicator */}
        {previewImage && (
          <div className="absolute top-3 left-3 bg-green-600/80 text-white text-xs px-2 py-1 rounded">
            Live Frame Preview
          </div>
        )}
      </div>

      {/* Timeline scrubber */}
      <div className="mt-3 bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-[var(--muted)]">0:00</span>
          <input
            type="range"
            min="0"
            max={Math.floor(duration)}
            value={Math.floor(time)}
            onChange={(e) => {
              const t = Number(e.target.value);
              setTime(t);
            }}
            onMouseUp={() => fetchPreview(time)}
            onTouchEnd={() => fetchPreview(time)}
            className="flex-1 accent-[var(--accent)] h-2"
          />
          <span className="text-xs text-[var(--muted)]">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick jump buttons */}
          <div className="flex gap-1.5">
            {[-30, -10, -1, 1, 10, 30].map((delta) => (
              <button
                key={delta}
                onClick={() => {
                  const t = Math.max(0, Math.min(duration, time + delta));
                  setTime(t);
                  fetchPreview(t);
                }}
                className="px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                {delta > 0 ? `+${delta}s` : `${delta}s`}
              </button>
            ))}
          </div>

          {/* Preview button */}
          <button
            onClick={() => fetchPreview(time)}
            disabled={loadingPreview}
            className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-50"
          >
            {loadingPreview ? "Loading..." : "Preview"}
          </button>

          {/* Capture button */}
          <button
            onClick={() => onTimestampSelect(Math.floor(time))}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            Capture at {formatTime(time)}
          </button>
        </div>
      </div>
    </div>
  );
}
