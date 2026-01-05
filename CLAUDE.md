# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TackTile is a local-first bookmarking app inspired by Pinterest. It runs entirely in the browser with no backend, no accounts, and no server-side processing. All data lives in the browser using IndexedDB.

## Architecture Constraints

These are non-negotiable boundaries defined in `adr/adr.md`:

### Data Model
- **Canonical data** (must be persisted): URL, board membership, added timestamp, user notes/tags
- **Derived data** (local cache only, disposable): page titles, favicons, OpenGraph images, thumbnails

### Storage
- IndexedDB for all canonical data and cached blobs
- localStorage only for lightweight UI state
- URLs are for navigation and one-time import payloads, never long-term storage

### CORS Policy
- CORS is a hard constraint, not a problem to solve
- Metadata fetching is best-effort only
- Failures are silent and non-blocking

### Share Links
- Format: `/#/import/<payload>` where payload is JSON → deflate-raw → base64url
- On import: decode, persist to IndexedDB, replace URL with `/board/<id>`
- Hard size ceiling enforced client-side; fallback to file export for large boards

## Build Commands

```bash
npm run build      # Build to dist/index.html (single file, minified)
npm run dev        # Build and watch for changes
npm run typecheck  # Type-check without emitting
```

Output is a single `dist/index.html` file with all JS inlined.

## Tech Stack

- Vanilla JS + TypeScript
- esbuild for bundling
- IndexedDB for storage
- Client-side routing
- Static hosting (GitHub Pages, Cloudflare Pages)

## Design Principles

1. **Local-first**: Everything works offline
2. **Minimal canonical data**: Only store what can't be re-derived
3. **URLs are transport, not storage**: Import payloads are consumed immediately and removed from history
4. **Best-effort previews**: Missing thumbnails/metadata are expected and non-fatal
5. **No blocking on network**: Bookmark creation is instant; enrichment happens in background
