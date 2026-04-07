# Recipe Video to Blog

Turn YouTube cooking videos into beautiful recipe blog posts with AI.

## Features

- Paste a YouTube recipe video URL
- Extract frames from the video (thumbnail grid or AI-suggested timestamps)
- Edit images: crop, resize, AI enhance via Gemini
- Create collages from multiple screenshots
- Generate a full recipe blog post with recipe card using Gemini AI
- Export as HTML or Markdown

## Setup

### Prerequisites

- **Node.js 18+** — [download here](https://nodejs.org/)
- **Gemini API Key** — [get one free here](https://aistudio.google.com/apikey)

### Optional (for best quality frame extraction)

- **yt-dlp** — `brew install yt-dlp` (macOS) or [download](https://github.com/yt-dlp/yt-dlp)
- **ffmpeg** — `brew install ffmpeg` (macOS) or [download](https://ffmpeg.org/download.html)

> Without yt-dlp/ffmpeg, the app uses YouTube's built-in storyboard thumbnails for frame extraction (lower resolution but works everywhere).

### Install & Run

```bash
git clone https://github.com/toshyte/recipes.git
cd recipes
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Enter your Gemini API key in the top-right input field.

## How to Use

1. **Paste a YouTube URL** of a cooking/recipe video and click "Load Video"
2. **Extract frames** — click "Extract All Frames" to see every frame, or use "AI Timestamp Suggestions" to let Gemini pick the best moments
3. **Select frames** — click thumbnails to select, fine-tune with +/- buttons, then "Capture Selected as HD"
4. **Edit images** — crop, resize, use Gemini AI to enhance, or create collages
5. **Generate blog** — click "Generate Blog" to create a full recipe post with images and recipe card
6. **Export** — download as HTML or Markdown

## Tech Stack

- Next.js 15
- youtubei.js (YouTube data)
- Google Gemini AI (timestamps, image editing, blog generation)
- Client-side frame capture (HTML5 video + canvas)
