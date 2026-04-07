import { NextRequest, NextResponse } from "next/server";

// Frame extraction is now done client-side using HTML5 video + canvas.
// This route exists as a fallback that proxies the video stream URL.
// The client fetches the stream URL and seeks to the correct time.

export async function POST(req: NextRequest) {
  const { url, timestamp } = await req.json();
  if (!url || timestamp === undefined) {
    return NextResponse.json({ error: "URL and timestamp required" }, { status: 400 });
  }

  // Return info telling the client to use client-side extraction
  return NextResponse.json({
    method: "client-side",
    message: "Use the video stream URL with client-side canvas capture",
    timestamp,
  });
}
