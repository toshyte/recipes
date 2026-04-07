import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, getInnertube } from "@/lib/youtube";

export const maxDuration = 30;

// Fetches YouTube storyboard sprite sheets and extracts individual thumbnails
// Works without direct video access — uses YouTube's pre-generated thumbnail sprites
export async function POST(req: NextRequest) {
  const { url, interval = 2 } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);
    const duration = info.basic_info.duration || 0;

    // Get storyboard data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storyboards = (info as any).storyboards;

    if (!storyboards) {
      // Fallback: return YouTube's standard thumbnails
      const thumbnails = [];
      for (let t = 0; t < duration; t += interval) {
        thumbnails.push({
          timestamp: t,
          image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        });
      }
      return NextResponse.json({ thumbnails, fallback: true });
    }

    // Parse storyboard spec to get sprite sheet URLs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boards = storyboards.boards || storyboards.storyboards || [];

    // Find the best quality storyboard (usually the last one)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const board = boards[boards.length - 1] || boards[0];

    if (!board) {
      return NextResponse.json({
        thumbnails: [{ timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }],
        fallback: true
      });
    }

    // Storyboard has: template_url, thumbnail_width, thumbnail_height,
    // thumbnail_count, columns, rows, interval (ms)
    const templateUrl = board.template_url || board.templateUrl || "";
    const thumbWidth = board.thumbnail_width || board.width || 160;
    const thumbHeight = board.thumbnail_height || board.height || 90;
    const cols = board.columns || board.cols || 10;
    const rows = board.rows || 10;
    const storyboardInterval = (board.interval || 2000) / 1000; // convert ms to seconds
    const thumbsPerSheet = cols * rows;

    if (!templateUrl) {
      return NextResponse.json({
        thumbnails: [{ timestamp: 0, image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }],
        fallback: true
      });
    }

    // Return storyboard metadata so client can extract frames from sprite sheets
    return NextResponse.json({
      storyboard: {
        templateUrl,
        thumbWidth,
        thumbHeight,
        cols,
        rows,
        interval: storyboardInterval,
        thumbsPerSheet,
        duration,
      },
      thumbnails: [], // client will extract from sprite sheets
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to get storyboard";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
