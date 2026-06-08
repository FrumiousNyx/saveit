# AnyDownloader - Social Media Downloader

A clean, fast, and distraction-free social media downloader that lets you download media from Instagram, Reddit, and TikTok without ads or sign-ups.

## Features

- **No Ads**: Clean interface without any advertisements
- **No Sign-up**: Start downloading immediately without creating an account
- **Multi-platform Support**: Download from Instagram, Reddit, and TikTok
- **Fast & Simple**: Just paste a link and get your media
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode**: Toggle between light and dark themes

## Supported Platforms

- Instagram (posts, reels)
- Reddit (videos, images, GIFs)
- TikTok (videos)

## Tech Stack

- **Framework**: Next.js 16
- **UI**: React 19, TailwindCSS 4
- **Icons**: Lucide React
- **Components**: shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18+ installed
- pnpm, npm, or yarn package manager

### Installation

1. Install dependencies:
```bash
pnpm install
# or
npm install
# or
yarn install
```

2. Run the development server:
```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Vercel will automatically detect Next.js and deploy

### Deploy to Other Platforms

This is a standard Next.js application and can be deployed to:
- Vercel (recommended)
- Netlify
- Railway
- Render
- Any platform that supports Next.js

## How It Works

The application uses:
- **Reddit**: Public JSON API endpoint
- **Instagram**: oEmbed API with HTML parsing fallback
- **TikTok**: oEmbed API with HTML parsing fallback

## Important Notes

- Only download content you own or have permission to use
- Respect each platform's terms of service
- Be aware of copyright laws in your jurisdiction
- Some content may be private or geo-restricted and cannot be downloaded

## License

This project is for educational purposes. Please use responsibly and respect content creators' rights.

## Support

If you encounter issues with specific links, it may be because:
- The content is private
- The content has been deleted
- The platform has changed their API
- The content is geo-restricted
