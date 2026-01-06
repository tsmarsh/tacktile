# TackTile

TackTile is a **local-first bookmarking app** inspired by Pinterest, designed to make collecting and sharing links fast, visual, and cheap to run.

**Live demo**: https://tacktyl.web.app

---

## Features

- **Boards** - Organize bookmarks into collections
- **Visual tiles** - Rich previews with images, titles, and favicons
- **Share via link** - Export boards as compressed URL payloads
- **Import/Export** - JSON file backup for large boards
- **Offline-first** - Everything works without internet
- **No account required** - All data lives in your browser

---

## Quick Start

### Use it now

Visit https://tacktyl.web.app - no setup required.

### Run locally

```bash
npm install
npm run build
npx serve dist
```

Open http://localhost:3000

### Development

```bash
npm run dev      # Build + watch
npm run typecheck # Type-check without emitting
```

---

## Architecture

### Frontend

- **Vanilla TypeScript** - No framework dependencies
- **IndexedDB** - Local storage for boards, bookmarks, and cached metadata
- **Hash router** - Client-side navigation (`/#/board/:id`)
- **Single HTML output** - All JS inlined into `dist/index.html`

### Backend (Optional)

- **Firebase Hosting** - Static site hosting
- **Firebase Function** - Metadata proxy to bypass CORS

The metadata function fetches page titles, images, and favicons server-side since browsers block cross-origin requests. If the function is unavailable, bookmarks still work - they just show the hostname instead of rich previews.

### Image Extraction

The metadata function checks multiple sources for the best preview image:

1. `og:image` (Open Graph)
2. `twitter:image` (Twitter Cards)
3. `link[rel=image_src]` (older convention)
4. Schema.org image data
5. Large content images (≥200px)

Icons, logos, and tracking pixels are filtered out.

---

## Data Model

### Canonical (persisted)

Only user-authored data is stored permanently:

- URL
- Board membership
- Added timestamp
- User notes/tags

### Derived (cached, disposable)

Everything else can be regenerated:

- Page titles
- Favicons
- Preview images
- Site names

---

## Sharing

Boards are shared by encoding canonical data into the URL:

```
/#/import/<base64url-compressed-json>
```

When opened:
1. Payload is decoded and decompressed
2. Board is imported to IndexedDB
3. URL is replaced with `/board/:id` (no history pollution)

For boards exceeding URL size limits (~8KB), export to JSON file instead.

---

## Deployment

### Firebase (recommended)

```bash
npm run build
firebase deploy
```

### GitHub Pages

Push to `main` - GitHub Actions handles deployment.

### Any static host

Upload `dist/index.html` to any static hosting service.

---

## Project Structure

```
src/
├── main.ts        # App entry, router setup
├── router.ts      # Hash-based client router
├── views.ts       # UI rendering
├── db.ts          # IndexedDB operations
├── types.ts       # TypeScript interfaces
├── metadata.ts    # Metadata fetching client
└── share.ts       # Import/export logic

functions/
└── index.js       # Firebase Function (metadata proxy)
```

---

## Configuration

### Firebase

Project config is in `firebase.json` and `.firebaserc`.

To use your own Firebase project:
1. Create a project at https://console.firebase.google.com
2. Update `.firebaserc` with your project ID
3. Update `METADATA_FUNCTION_URL` in `src/metadata.ts`

---

## Philosophy

TackTile treats the browser as a **personal tool**, not a thin client for a service.

- If you can calculate it again, don't store it in the URL
- If the user didn't author it, it's not canonical
- Everything else is cache

---

## License

MIT
