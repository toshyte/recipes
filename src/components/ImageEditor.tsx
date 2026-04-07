"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ImageEditorProps {
  image: string;
  originalImage?: string; // full-res original for re-cropping
  cropPreset?: { w: number; h: number }; // initial crop size
  onSave: (editedImage: string) => void;
  onCancel: () => void;
}

interface AspectRatio {
  label: string;
  ratio: number | null; // null = free/original
}

const ASPECT_RATIOS: AspectRatio[] = [
  { label: "Original", ratio: null },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "1:1", ratio: 1 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "2:3", ratio: 2 / 3 },
];

const SIZE_PRESETS = [
  { label: "Blog Wide (1200×675)", w: 1200, h: 675 },
  { label: "Blog (1200×900)", w: 1200, h: 900 },
  { label: "Square (800×800)", w: 800, h: 800 },
  { label: "Pinterest (735×1102)", w: 735, h: 1102 },
  { label: "Instagram (1080×1080)", w: 1080, h: 1080 },
  { label: "Facebook (1200×630)", w: 1200, h: 630 },
];

export default function ImageEditor({ image, originalImage, cropPreset, onSave, onCancel }: ImageEditorProps) {
  // Use original image if available (for re-cropping without quality loss)
  const sourceImage = originalImage || image;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Image state
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  // Aspect ratio crop + reposition
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(ASPECT_RATIOS[0]);
  const [outputW, setOutputW] = useState(0);
  const [outputH, setOutputH] = useState(0);

  // Pan/reposition state (offset of image within the crop frame, in % of overshoot)
  const [panX, setPanX] = useState(0.5); // 0..1 where 0.5 = centered
  const [panY, setPanY] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Load image (use original source for re-cropping)
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);

      // If we have a crop preset (from batch resize), apply it
      if (cropPreset) {
        setOutputW(cropPreset.w);
        setOutputH(cropPreset.h);
        // Find matching aspect ratio
        const r = cropPreset.w / cropPreset.h;
        const match = ASPECT_RATIOS.find(
          (ar) => ar.ratio && Math.abs(ar.ratio - r) < 0.02
        );
        if (match) setSelectedRatio(match);
      } else {
        setOutputW(img.naturalWidth);
        setOutputH(img.naturalHeight);
      }
    };
    img.src = sourceImage;
  }, [sourceImage, cropPreset]);

  // When aspect ratio changes, compute output dimensions + reset pan
  useEffect(() => {
    if (!naturalW || !naturalH) return;

    if (!selectedRatio.ratio) {
      setOutputW(naturalW);
      setOutputH(naturalH);
      setPanX(0.5);
      setPanY(0.5);
      return;
    }

    const r = selectedRatio.ratio;
    const imgRatio = naturalW / naturalH;

    if (imgRatio > r) {
      // Image is wider than target — crop sides, full height
      setOutputH(naturalH);
      setOutputW(Math.round(naturalH * r));
    } else {
      // Image is taller than target — crop top/bottom, full width
      setOutputW(naturalW);
      setOutputH(Math.round(naturalW / r));
    }
    setPanX(0.5);
    setPanY(0.5);
  }, [selectedRatio, naturalW, naturalH]);

  // Apply a size preset
  const applyPreset = (w: number, h: number) => {
    setOutputW(w);
    setOutputH(h);
    // Find matching ratio
    const r = w / h;
    const match = ASPECT_RATIOS.find(
      (ar) => ar.ratio && Math.abs(ar.ratio - r) < 0.01
    );
    setSelectedRatio(match || ASPECT_RATIOS[0]);
    setPanX(0.5);
    setPanY(0.5);
  };

  // Compute the source crop rectangle based on output dims + pan position
  const getCropRect = useCallback(() => {
    if (!naturalW || !naturalH || !outputW || !outputH) {
      return { sx: 0, sy: 0, sw: naturalW, sh: naturalH };
    }

    const outRatio = outputW / outputH;
    const imgRatio = naturalW / naturalH;

    let sw: number, sh: number, sx: number, sy: number;

    if (imgRatio > outRatio) {
      // Image is wider — crop horizontally
      sh = naturalH;
      sw = Math.round(naturalH * outRatio);
      const maxOffset = naturalW - sw;
      sx = Math.round(maxOffset * panX);
      sy = 0;
    } else {
      // Image is taller — crop vertically
      sw = naturalW;
      sh = Math.round(naturalW / outRatio);
      const maxOffset = naturalH - sh;
      sx = 0;
      sy = Math.round(maxOffset * panY);
    }

    return { sx, sy, sw, sh };
  }, [naturalW, naturalH, outputW, outputH, panX, panY]);

  // Render preview
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !outputW || !outputH) return;

    canvas.width = outputW;
    canvas.height = outputH;

    const ctx = canvas.getContext("2d")!;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

    const { sx, sy, sw, sh } = getCropRect();
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputW, outputH);
  }, [outputW, outputH, brightness, contrast, saturation, getCropRect]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Drag to reposition
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStartRef.current.x) / rect.width;
    const dy = (e.clientY - dragStartRef.current.y) / rect.height;

    // Invert because dragging right should move crop left
    setPanX(Math.max(0, Math.min(1, dragStartRef.current.panX - dx)));
    setPanY(Math.max(0, Math.min(1, dragStartRef.current.panY - dy)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Can the image be panned?
  const canPanHorizontally = naturalW > 0 && outputW > 0 && (naturalW / naturalH) > (outputW / outputH);
  const canPanVertically = naturalW > 0 && outputH > 0 && (naturalW / naturalH) < (outputW / outputH);
  const canPan = selectedRatio.ratio !== null && (canPanHorizontally || canPanVertically);

  const handleSave = () => {
    renderCanvas();
    setTimeout(() => {
      const dataUrl = canvasRef.current?.toDataURL("image/jpeg", 0.92) || image;
      onSave(dataUrl);
    }, 50);
  };

  const resetAll = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setSelectedRatio(ASPECT_RATIOS[0]);
    setPanX(0.5);
    setPanY(0.5);
    if (imgRef.current) {
      setOutputW(imgRef.current.naturalWidth);
      setOutputH(imgRef.current.naturalHeight);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex" onMouseUp={handleMouseUp}>
      {/* Sidebar */}
      <div className="w-80 bg-[var(--card)] border-r border-[var(--border)] p-5 overflow-y-auto flex flex-col gap-5">
        <h2 className="text-lg font-bold">Image Editor</h2>

        {/* Aspect Ratio */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Aspect Ratio</h3>
          <div className="grid grid-cols-4 gap-1.5">
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.label}
                onClick={() => setSelectedRatio(ar)}
                className={`text-xs py-2 rounded-lg border transition-colors cursor-pointer ${
                  selectedRatio.label === ar.label
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
          {canPan && (
            <p className="text-xs text-[var(--accent)] mt-2">
              Drag the preview to reposition the crop
            </p>
          )}
        </div>

        {/* Size presets */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Size Presets</h3>
          <div className="flex flex-col gap-1.5">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.w, p.h)}
                className="text-left text-xs px-3 py-2 rounded-lg hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom size */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Output Size</h3>
          <div className="flex gap-2">
            <div>
              <label className="text-xs text-[var(--muted)]">Width</label>
              <input
                type="number"
                value={outputW}
                onChange={(e) => {
                  const w = Number(e.target.value);
                  setOutputW(w);
                  if (selectedRatio.ratio) {
                    setOutputH(Math.round(w / selectedRatio.ratio));
                  }
                }}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Height</label>
              <input
                type="number"
                value={outputH}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  setOutputH(h);
                  if (selectedRatio.ratio) {
                    setOutputW(Math.round(h * selectedRatio.ratio));
                  }
                }}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Original: {naturalW} × {naturalH}
          </p>
        </div>

        {/* Adjustments */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-[var(--muted)]">Adjustments</h3>
          {[
            { label: "Brightness", value: brightness, set: setBrightness },
            { label: "Contrast", value: contrast, set: setContrast },
            { label: "Saturation", value: saturation, set: setSaturation },
          ].map(({ label, value, set }) => (
            <div key={label} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span>{label}</span>
                <span className="text-[var(--muted)]">{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={value}
                onChange={(e) => set(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={resetAll}
            className="w-full text-xs py-2 rounded-lg border border-[var(--border)] hover:border-[var(--muted)] transition-colors cursor-pointer"
          >
            Reset All
          </button>
          <button
            onClick={handleSave}
            className="w-full text-sm py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:brightness-110 transition-all cursor-pointer"
          >
            Save Changes
          </button>
          <button
            onClick={onCancel}
            className="w-full text-xs py-2 text-[var(--muted)] hover:text-white transition-colors cursor-pointer"
          >
            Discard & Close
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto">
        {/* Crop frame indicator */}
        <div className="mb-4 text-sm text-[var(--muted)]">
          Output: {outputW} × {outputH}
          {canPan && " — drag to reposition"}
        </div>

        <div
          ref={previewRef}
          onMouseDown={canPan ? handleMouseDown : undefined}
          onMouseMove={canPan ? handleMouseMove : undefined}
          className="relative"
          style={{ cursor: canPan ? (isDragging ? "grabbing" : "grab") : "default" }}
        >
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl border-2 border-[var(--border)]"
          />

          {/* Pan direction indicators */}
          {canPan && !isDragging && (
            <>
              {canPanHorizontally && (
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none">
                  <div className={`w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ${panX > 0.05 ? 'opacity-100' : 'opacity-20'}`}>
                    ←
                  </div>
                  <div className={`w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ${panX < 0.95 ? 'opacity-100' : 'opacity-20'}`}>
                    →
                  </div>
                </div>
              )}
              {canPanVertically && (
                <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col items-center justify-between py-2 pointer-events-none">
                  <div className={`w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ${panY > 0.05 ? 'opacity-100' : 'opacity-20'}`}>
                    ↑
                  </div>
                  <div className={`w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ${panY < 0.95 ? 'opacity-100' : 'opacity-20'}`}>
                    ↓
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
