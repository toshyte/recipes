"use client";

import { useState, useEffect } from "react";

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
  thumbnail,
  duration,
  onTimestampSelect,
  currentTime,
}: VideoPlayerProps) {
  const [time, setTime] = useState(currentTime ?? 0);
  const [showEmbed, setShowEmbed] = useState(false);

  // Sync when parent changes currentTime (e.g. clicking a suggestion)
  useEffect(() => {
    if (currentTime !== undefined) {
      setTime(currentTime);
    }
  }, [currentTime]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const thumbUrl =
    thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <div className="relative">
      {/* Video preview area */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
        {showEmbed ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(time)}&autoplay=1&rel=0`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <>
            <img
              src={thumbUrl}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
            {/* Play button overlay */}
            <button
              onClick={() => setShowEmbed(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer group"
            >
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          </>
        )}

        {/* YouTube link */}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(time)}s`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 left-3 flex items-center gap-2 bg-red-600/90 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors z-10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch on YouTube
        </a>

        {/* Time badge */}
        <div className="absolute top-3 right-3 bg-black/80 text-white text-sm px-3 py-1.5 rounded-lg font-mono z-10">
          {formatTime(time)} / {formatTime(duration)}
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="mt-3 bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-[var(--muted)]">0:00</span>
          <input
            type="range"
            min="0"
            max={Math.max(1, Math.floor(duration))}
            value={Math.floor(time)}
            onChange={(e) => {
              const t = Number(e.target.value);
              setTime(t);
              // Update YouTube embed to this time
              if (showEmbed) {
                setShowEmbed(false);
                setTimeout(() => setShowEmbed(true), 100);
              }
            }}
            className="flex-1 accent-[var(--accent)] h-2"
          />
          <span className="text-xs text-[var(--muted)]">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick jump buttons */}
          <div className="flex gap-1.5">
            {[-30, -10, -1, 1, 10, 30].map((delta) => (
              <button
                key={delta}
                onClick={() => {
                  const t = Math.max(0, Math.min(duration, time + delta));
                  setTime(t);
                }}
                className="px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                {delta > 0 ? `+${delta}s` : `${delta}s`}
              </button>
            ))}
          </div>

          {/* Play at time button */}
          <button
            onClick={() => {
              setShowEmbed(false);
              setTimeout(() => setShowEmbed(true), 100);
            }}
            className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            Preview
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
