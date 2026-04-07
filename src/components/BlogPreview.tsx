"use client";

import { Screenshot } from "./ScreenshotGallery";

interface BlogPreviewProps {
  html: string;
  screenshots: Screenshot[];
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  onClose: () => void;
  onExport: (format: "html" | "markdown") => void;
}

export default function BlogPreview({
  html,
  screenshots,
  metaTitle,
  metaDescription,
  keywords,
  onClose,
  onExport,
}: BlogPreviewProps) {
  // Replace image placeholders with actual images
  let processedHtml = html;
  screenshots.forEach((shot, idx) => {
    const placeholder = `<!-- IMAGE_${idx + 1} -->`;
    const imgTag = `<figure style="margin:2em 0"><img src="${shot.image}" alt="${shot.description || `Step ${idx + 1}`}" style="width:100%;border-radius:12px;"/><figcaption style="text-align:center;color:#888;font-size:0.9em;margin-top:0.5em">${shot.description || `Step ${idx + 1}`}</figcaption></figure>`;
    processedHtml = processedHtml.replace(placeholder, imgTag);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
        <div>
          <h2 className="text-lg font-bold">Blog Post Preview</h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            {metaTitle} &mdash; {keywords}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onExport("html")}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:brightness-110 transition-all cursor-pointer"
          >
            Export HTML
          </button>
          <button
            onClick={() => onExport("markdown")}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            Export Markdown
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* SEO Meta preview */}
      <div className="px-6 py-3 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="max-w-2xl">
          <div className="text-blue-400 text-lg">{metaTitle}</div>
          <div className="text-green-500 text-sm">yourblog.com/recipes/...</div>
          <div className="text-sm text-[var(--muted)]">{metaDescription}</div>
        </div>
      </div>

      {/* Blog content */}
      <div className="flex-1 overflow-y-auto">
        <style>{`
          .recipe-card {
            border: 2px solid #f97316;
            border-radius: 16px;
            padding: 2em;
            margin: 2em 0;
            background: #1a1a1a;
          }
          .recipe-card h2, .recipe-card h3 { color: #f97316; }
          .recipe-card ul, .recipe-card ol { padding-left: 1.5em; }
          .recipe-meta {
            background: #1a1a1a;
            padding: 1.5em;
            border-radius: 12px;
            margin: 1.5em 0;
          }
          .pro-tips {
            background: #1a1a00;
            border-left: 4px solid #f97316;
            padding: 1.5em;
            border-radius: 0 12px 12px 0;
            margin: 1.5em 0;
          }
        `}</style>
        <div
          className="max-w-3xl mx-auto py-10 px-6 prose prose-invert"
          style={{
            lineHeight: 1.8,
            fontSize: "1.05rem",
          }}
          dangerouslySetInnerHTML={{ __html: processedHtml }}
        />
      </div>
    </div>
  );
}
