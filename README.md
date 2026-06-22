# BlurIt

Blur faces, license plates, and sensitive info in photos **before** you share them online. Auto-detect faces, tap to blur, download. No uploads, no sign-up, 100% free.

**Your photos never leave your device.**

> Every photo of your kid online has their face exposed. BlurIt fixes that in 3 seconds — without uploading your photos anywhere.

## The privacy promise

BlurIt is a **fully client-side** web app. There is no server.

- **No uploads.** Photos are decoded, blurred, and encoded entirely inside your browser. They are never transmitted anywhere.
- **No tracking, no analytics.** Zero third-party scripts, zero cookies, zero telemetry.
- **No accounts.** Nothing to sign up for.
- **Local storage only.** Your theme preference and one-time terms acceptance are stored in `localStorage` — nothing else.
- **No retention.** When you open a new photo or close the tab, the previous photo is gone from memory.

## How it works

1. **Drop a photo** (JPEG, PNG, WebP, HEIC, BMP) — or paste from clipboard.
2. **Faces are auto-detected** using your browser's native `FaceDetector` API (Chrome/Edge). On browsers without it, switch to manual mode and draw blur boxes.
3. **Tap a face** to blur it (dashed amber → solid emerald). Or use the **Brush** tool to blur any region (license plates, addresses, etc.).
4. **Pick a blur style**: Pixelate (mosaic), Gaussian (smooth), or Black box (max privacy). Choose intensity: Light / Medium / Heavy.
5. **Download** the protected photo. Done.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) (New York)
- 100% client-side — no backend, no database, no API routes
- Native `FaceDetector` API → manual fallback (no model downloads, preserving the zero-network privacy guarantee)
- Canvas API for blurring (pixelate via downscale/upscale, gaussian via `ctx.filter`)
- `createImageBitmap` for fast, off-main-thread image decode
- [`heic2any`](https://github.com/catdad-experiments/heic2any) lazy-loaded only for HEIC files
- `next-themes` for dark mode

## Run locally

```bash
bun install
bun run dev
```

Open http://localhost:3000.

> In the sandbox/preview environment, use the **Preview Panel** to view the app — `localhost` is not directly accessible.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. No environment variables needed.
4. Deploy.

The build is a standard `next build` — no server, no secrets.

## Project structure

```
src/
  app/
    layout.tsx          # root layout, fonts, theme provider, metadata
    page.tsx            # renders <BlurItApp />
    icon.svg            # favicon (eye + blur mosaic mark)
    globals.css         # Tailwind 4 theme tokens
  components/
    blurit/
      blurit-app.tsx    # orchestrator: state, file handling, export
      dropzone.tsx      # empty-state dropzone (drag/drop/click/paste)
      photo-canvas.tsx  # canvas renderer + face badges + brush/erase
      face-badge.tsx    # tap-to-blur face overlay
      editor-toolbar.tsx# tools, blur type, intensity, download
      settings-menu.tsx # theme / privacy / terms / github / donate
      terms-gate.tsx    # non-dismissable first-visit dialog
      legal-dialog.tsx  # privacy & terms content
      logo.tsx          # flat SVG mark
      theme-provider.tsx
  lib/
    blurit/
      types.ts          # shared types
      blur.ts           # pixelate / gaussian / black render fns
      face-detect.ts    # native FaceDetector wrapper + fallback
      image.ts          # decode (incl. HEIC), encode, format helpers
```

## Author

**Jeffrey Hamilton** · [GitHub](https://github.com/JeffreyHamilton6399)

☕ [Buy me a coffee](https://buymeacoffee.com/jeffreyscof)
