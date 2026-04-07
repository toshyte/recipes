"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Screenshot } from "./ScreenshotGallery";

interface CollageCreatorProps {
  screenshots: Screenshot[];
  onSave: (collageImage: string) => void;
  onCancel: () => void;
}

interface Layout {
  label: string;
  id: string;
  minImages: number;
  maxImages: number;
}

const LAYOUTS: Layout[] = [
  { label: "2 Side by Side", id: "2h", minImages: 2, maxImages: 2 },
  { label: "2 Stacked", id: "2v", minImages: 2, maxImages: 2 },
  { label: "3 Top + Bottom", id: "3tb", minImages: 3, maxImages: 3 },
  { label: "3 Left + Right", id: "3lr", minImages: 3, maxImages: 3 },
  { label: "2×2 Grid", id: "2x2", minImages: 4, maxImages: 4 },
  { label: "3×2 Grid", id: "3x2", minImages: 6, maxImages: 6 },
  { label: "Horizontal Strip", id: "hstrip", minImages: 2, maxImages: 8 },
  { label: "Vertical Strip", id: "vstrip", minImages: 2, maxImages: 8 },
];

export default function CollageCreator({ screenshots, onSave, onCancel }: CollageCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [layout, setLayout] = useState<string>("2h");
  const [gap, setGap] = useState(8);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [outputWidth, setOutputWidth] = useState(1200);

  const selectedShots = selectedIds
    .map((id) => screenshots.find((s) => s.id === id))
    .filter(Boolean) as Screenshot[];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const availableLayouts = LAYOUTS.filter(
    (l) => selectedShots.length >= l.minImages && selectedShots.length <= l.maxImages
  );

  // Auto-select a valid layout when selection changes
  useEffect(() => {
    if (availableLayouts.length > 0 && !availableLayouts.find((l) => l.id === layout)) {
      setLayout(availableLayouts[0].id);
    }
  }, [selectedShots.length, availableLayouts, layout]);

  const renderCollage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedShots.length < 2) return;

    const images: HTMLImageElement[] = [];
    let loaded = 0;

    selectedShots.forEach((shot, i) => {
      const img = new Image();
      img.onload = () => {
        images[i] = img;
        loaded++;
        if (loaded === selectedShots.length) {
          drawCollage(canvas, images);
        }
      };
      img.src = shot.image;
    });

    function drawCollage(cvs: HTMLCanvasElement, imgs: HTMLImageElement[]) {
      const ctx = cvs.getContext("2d")!;
      const g = gap;
      const w = outputWidth;
      const n = imgs.length;

      // Calculate cell dimensions based on layout
      let cols = 1, rows = 1;
      let cellConfigs: { x: number; y: number; w: number; h: number }[] = [];

      const cellW = (w: number, cols: number) => (w - g * (cols + 1)) / cols;

      switch (layout) {
        case "2h": {
          cols = 2; rows = 1;
          const cw = cellW(w, 2);
          const ch = cw * 0.75;
          cvs.width = w;
          cvs.height = ch + g * 2;
          cellConfigs = [
            { x: g, y: g, w: cw, h: ch },
            { x: g * 2 + cw, y: g, w: cw, h: ch },
          ];
          break;
        }
        case "2v": {
          const cw = w - g * 2;
          const ch = cw * 0.5;
          cvs.width = w;
          cvs.height = ch * 2 + g * 3;
          cellConfigs = [
            { x: g, y: g, w: cw, h: ch },
            { x: g, y: g * 2 + ch, w: cw, h: ch },
          ];
          break;
        }
        case "3tb": {
          const topW = w - g * 2;
          const topH = topW * 0.5;
          const botCW = cellW(w, 2);
          const botH = botCW * 0.6;
          cvs.width = w;
          cvs.height = topH + botH + g * 3;
          cellConfigs = [
            { x: g, y: g, w: topW, h: topH },
            { x: g, y: g * 2 + topH, w: botCW, h: botH },
            { x: g * 2 + botCW, y: g * 2 + topH, w: botCW, h: botH },
          ];
          break;
        }
        case "3lr": {
          const leftW = (w - g * 3) * 0.55;
          const rightW = (w - g * 3) * 0.45;
          const leftH = leftW * 1.1;
          const rightH = (leftH - g) / 2;
          cvs.width = w;
          cvs.height = leftH + g * 2;
          cellConfigs = [
            { x: g, y: g, w: leftW, h: leftH },
            { x: g * 2 + leftW, y: g, w: rightW, h: rightH },
            { x: g * 2 + leftW, y: g * 2 + rightH, w: rightW, h: rightH },
          ];
          break;
        }
        case "2x2": {
          cols = 2; rows = 2;
          const cw = cellW(w, 2);
          const ch = cw * 0.7;
          cvs.width = w;
          cvs.height = ch * 2 + g * 3;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              cellConfigs.push({
                x: g + c * (cw + g),
                y: g + r * (ch + g),
                w: cw,
                h: ch,
              });
            }
          }
          break;
        }
        case "3x2": {
          cols = 3; rows = 2;
          const cw = cellW(w, 3);
          const ch = cw * 0.7;
          cvs.width = w;
          cvs.height = ch * 2 + g * 3;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              cellConfigs.push({
                x: g + c * (cw + g),
                y: g + r * (ch + g),
                w: cw,
                h: ch,
              });
            }
          }
          break;
        }
        case "hstrip": {
          const cw = cellW(w, n);
          const ch = cw * 0.75;
          cvs.width = w;
          cvs.height = ch + g * 2;
          for (let i = 0; i < n; i++) {
            cellConfigs.push({ x: g + i * (cw + g), y: g, w: cw, h: ch });
          }
          break;
        }
        case "vstrip": {
          const cw = w - g * 2;
          const ch = cw * 0.45;
          cvs.width = w;
          cvs.height = ch * n + g * (n + 1);
          for (let i = 0; i < n; i++) {
            cellConfigs.push({ x: g, y: g + i * (ch + g), w: cw, h: ch });
          }
          break;
        }
      }

      // Draw background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      // Draw images with cover-crop
      cellConfigs.forEach((cell, i) => {
        if (!imgs[i]) return;
        const img = imgs[i];
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const cellRatio = cell.w / cell.h;

        let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (imgRatio > cellRatio) {
          sw = img.naturalHeight * cellRatio;
          sx = (img.naturalWidth - sw) / 2;
        } else {
          sh = img.naturalWidth / cellRatio;
          sy = (img.naturalHeight - sh) / 2;
        }

        // Rounded corners via clipping
        ctx.save();
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(cell.x + r, cell.y);
        ctx.lineTo(cell.x + cell.w - r, cell.y);
        ctx.quadraticCurveTo(cell.x + cell.w, cell.y, cell.x + cell.w, cell.y + r);
        ctx.lineTo(cell.x + cell.w, cell.y + cell.h - r);
        ctx.quadraticCurveTo(cell.x + cell.w, cell.y + cell.h, cell.x + cell.w - r, cell.y + cell.h);
        ctx.lineTo(cell.x + r, cell.y + cell.h);
        ctx.quadraticCurveTo(cell.x, cell.y + cell.h, cell.x, cell.y + cell.h - r);
        ctx.lineTo(cell.x, cell.y + r);
        ctx.quadraticCurveTo(cell.x, cell.y, cell.x + r, cell.y);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, cell.x, cell.y, cell.w, cell.h);
        ctx.restore();
      });
    }
  }, [selectedShots, layout, gap, bgColor, outputWidth]);

  useEffect(() => {
    renderCollage();
  }, [renderCollage]);

  const handleSave = () => {
    const dataUrl = canvasRef.current?.toDataURL("image/jpeg", 0.92);
    if (dataUrl) onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex">
      {/* Sidebar */}
      <div className="w-80 bg-[var(--card)] border-r border-[var(--border)] p-5 overflow-y-auto flex flex-col gap-5">
        <h2 className="text-lg font-bold">Collage Creator</h2>

        {/* Select images */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">
            Select Images ({selectedIds.length})
          </h3>
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {screenshots.map((shot, idx) => (
              <button
                key={shot.id}
                onClick={() => toggleSelect(shot.id)}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer ${
                  selectedIds.includes(shot.id)
                    ? "border-[var(--accent)]"
                    : "border-[var(--border)] opacity-50 hover:opacity-80"
                }`}
              >
                <img src={shot.image} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] text-center">
                  #{idx + 1}
                </div>
                {selectedIds.includes(shot.id) && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-[var(--accent)] rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                    {selectedIds.indexOf(shot.id) + 1}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Layout */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Layout</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {LAYOUTS.map((l) => {
              const available = selectedShots.length >= l.minImages && selectedShots.length <= l.maxImages;
              return (
                <button
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  disabled={!available}
                  className={`text-xs py-2 px-2 rounded-lg border transition-colors cursor-pointer ${
                    layout === l.id
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : available
                      ? "border-[var(--border)] hover:border-[var(--accent)]"
                      : "border-[var(--border)] opacity-30 cursor-not-allowed"
                  }`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Settings</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Gap</span>
                <span className="text-[var(--muted)]">{gap}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={gap}
                onChange={(e) => setGap(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Width</span>
                <span className="text-[var(--muted)]">{outputWidth}px</span>
              </div>
              <input
                type="range"
                min="600"
                max="2400"
                step="100"
                value={outputWidth}
                onChange={(e) => setOutputWidth(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs block mb-1">Background</label>
              <div className="flex gap-2">
                {["#ffffff", "#000000", "#f5f5f5", "#f97316", "#1a1a1a"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setBgColor(c)}
                    className={`w-7 h-7 rounded-lg border-2 cursor-pointer ${
                      bgColor === c ? "border-[var(--accent)]" : "border-[var(--border)]"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={selectedShots.length < 2}
            className="w-full text-sm py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
          >
            Save Collage
          </button>
          <button
            onClick={onCancel}
            className="w-full text-xs py-2 text-[var(--muted)] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        {selectedShots.length < 2 ? (
          <p className="text-[var(--muted)] text-sm">Select at least 2 images to create a collage</p>
        ) : (
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}
