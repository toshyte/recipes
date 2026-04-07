import { NextRequest, NextResponse } from "next/server";

// Thumbnail grid extraction is now done client-side using HTML5 video + canvas.
// This route is kept for API compatibility but delegates to client.

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  return NextResponse.json({
    method: "client-side",
    message: "Use the video stream URL with client-side canvas capture for thumbnails",
  });
}
