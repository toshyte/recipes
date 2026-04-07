"use client";

import { useState } from "react";

export interface Screenshot {
  id: string;
  image: string;
  originalImage?: string; // preserved for re-cropping
  timestamp: number;
  description?: string;
  edited?: boolean;
  cropPreset?: { w: number; h: number }; // current crop dimensions
}

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  onReorder: (screenshots: Screenshot[]) => void;
  onDescriptionChange: (id: string, desc: string) => void;
}

export default function ScreenshotGallery({
  screenshots,
  onRemove,
  onEdit,
  onReorder,
  onDescriptionChange,
}: ScreenshotGalleryProps) {
  const [dragId, setDragId] = useState<string | null>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleDragStart = (id: string) => setDragId(id);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const items = [...screenshots];
    const dragIdx = items.findIndex((s) => s.id === dragId);
    const targetIdx = items.findIndex((s) => s.id === targetId);
    const [removed] = items.splice(dragIdx, 1);
    items.splice(targetIdx, 0, removed);
    onReorder(items);
    setDragId(null);
  };

  if (screenshots.length === 0) {
    return (
      <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-12 text-center text-[var(--muted)]">
        <svg className="mx-auto mb-3 opacity-40" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <p className="text-sm">No screenshots yet. Play the video and capture frames at key moments.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {screenshots.map((shot, idx) => (
        <div
          key={shot.id}
          draggable
          onDragStart={() => handleDragStart(shot.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(shot.id)}
          className={`group relative bg-[var(--card)] rounded-xl overflow-hidden border border-[var(--border)] transition-all hover:border-[var(--accent)] ${
            dragId === shot.id ? "opacity-50" : ""
          }`}
        >
          {/* Image */}
          <div className="relative aspect-video">
            <img
              src={shot.image}
              alt={shot.description || `Screenshot ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
              {formatTime(shot.timestamp)}
            </div>
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-bold">
              #{idx + 1}
            </div>
            {shot.edited && (
              <div className="absolute bottom-2 left-2 bg-green-600/80 text-white text-xs px-2 py-1 rounded">
                Edited
              </div>
            )}
          </div>

          {/* Description */}
          <div className="p-3">
            <input
              type="text"
              value={shot.description || ""}
              onChange={(e) => onDescriptionChange(shot.id, e.target.value)}
              placeholder="Describe this step..."
              className="w-full bg-transparent text-sm border-b border-[var(--border)] pb-1 focus:border-[var(--accent)] outline-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex border-t border-[var(--border)]">
            <button
              onClick={() => onEdit(shot.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              onClick={() => onRemove(shot.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-[var(--muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors border-l border-[var(--border)] cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
