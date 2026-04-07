import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, getInnertube } from "@/lib/youtube";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { url, interval = 2 } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    let storyboards: unknown = null;
    let duration = 0;

    try {
      const yt = await getInnertube();
      const info = await yt.getBasicInfo(videoId);
      duration = info.basic_info.duration || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storyboards = (info as any).storyboards;
    } catch (e) {
      console.error("Innertube failed:", e);
    }

    if (!storyboards) {
      // No storyboard — return basic YouTube thumbnails at fixed intervals
      const thumbnails = [];
      const d = duration || 300; // assume 5 min if unknown
      for (let t = 0; t < d; t += interval) {
        thumbnails.push({
          timestamp: t,
          // YouTube only has a few standard thumbnails, but we label them with timestamps
          image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        });
      }
      // Just return a few standard thumbnails instead of hundreds of the same image
      return NextResponse.json({
        thumbnails: [
          { timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` },
          { timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/0.jpg` },
          { timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/1.jpg` },
          { timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/2.jpg` },
          { timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/3.jpg` },
        ],
        fallback: true,
        duration: d,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = storyboards as any;
    const boards = sb.boards || sb.storyboards || [];
    const board = boards[boards.length - 1] || boards[0];

    if (!board) {
      return NextResponse.json({
        thumbnails: [{ timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }],
        fallback: true,
        duration,
      });
    }

    const templateUrl = board.template_url || board.templateUrl || "";
    const thumbWidth = board.thumbnail_width || board.width || 160;
    const thumbHeight = board.thumbnail_height || board.height || 90;
    const cols = board.columns || board.cols || 10;
    const rows = board.rows || 10;
    const storyboardInterval = (board.interval || 2000) / 1000;
    const thumbsPerSheet = cols * rows;

    if (!templateUrl) {
      return NextResponse.json({
        thumbnails: [{ timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }],
        fallback: true,
        duration,
      });
    }

    // Return storyboard metadata — client will fetch and slice sprite sheets
    // Include the raw sprite sheet URLs so client can fetch them directly
    const totalThumbs = Math.ceil(duration / storyboardInterval);
    const totalSheets = Math.ceil(totalThumbs / thumbsPerSheet);
    const sheetUrls: string[] = [];

    for (let i = 0; i < totalSheets; i++) {
      sheetUrls.push(templateUrl.replace("$M", String(i)));
    }

    return NextResponse.json({
      storyboard: {
        sheetUrls,
        thumbWidth,
        thumbHeight,
        cols,
        rows,
        interval: storyboardInterval,
        thumbsPerSheet,
        duration,
      },
      thumbnails: [],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to get storyboard";
    console.error("Storyboard error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
