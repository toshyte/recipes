import { Innertube } from "youtubei.js";

let cachedYt: Innertube | null = null;

export async function getInnertube(): Promise<Innertube> {
  if (!cachedYt) {
    cachedYt = await Innertube.create();
  }
  return cachedYt;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Lightweight fallback using YouTube oEmbed (no youtubei.js needed)
export async function getVideoInfoFallback(videoId: string) {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) throw new Error("Failed to fetch video info from YouTube");
  const data = await res.json();

  // Get duration from YouTube's page (noembed provides more data)
  let duration = 0;
  try {
    const noembed = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const noembedData = await noembed.json();
    if (noembedData.duration) duration = Number(noembedData.duration);
  } catch {
    // noembed not available, duration stays 0
  }

  return {
    title: data.title || "",
    duration,
    thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    description: "",
    channel: data.author_name || "",
    videoId,
  };
}
