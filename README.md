# TackTile

TackTile is a **local-first bookmarking app** inspired by Pinterest, designed to make collecting and sharing links fast, visual, and cheap to run.

There is **no backend you control**.
There is **no account system**.
There is **no server-side scraping**.

Everything lives in the browser.

---

## What TackTile Is

* A way to collect URLs into **boards**
* A visual, tile-based UI (thumbnails when possible)
* **Share boards via links** using compressed URL payloads
* Offline-first by default

## What TackTile Is *Not*

* A social network
* A hosted service with accounts
* A guaranteed preview generator
* A place to store infinite data in a URL

---

## Core Design Principles

### 1. Local-First

All boards and bookmarks are stored locally in your browser using **IndexedDB**.

If the app loads offline, everything still works.

### 2. Minimal Canonical Data

Only data that cannot be re-derived is treated as canonical:

* URL
* Board membership
* Added timestamp
* Optional user notes / tags

Everything else (titles, previews, thumbnails) is **derived and disposable**.

### 3. URLs Are Transport, Not Storage

TackTile uses URLs **only** to:

* Navigate between boards
* Share a board as a **one-time import link**

When you open a shared link:

1. The board payload is decoded and imported into local storage
2. A local board ID is created
3. The URL is immediately replaced with a short `/board/<id>` route

The long payload never lives in browser history.

### 4. Sharing Without a Backend

Boards are shared by encoding their canonical data into the URL:

* JSON → compressed → base64url
* Embedded in a `/#/import/<payload>` link

This enables **true link-based sharing** with zero infrastructure.

Because browsers have URL length limits (especially on mobile), sharing has an intentional size ceiling.

When a board exceeds that limit, TackTile falls back to:

* Export board to file (JSON)
* Import board from file

Still no backend required.

### 5. Best-Effort Previews

TackTile attempts to enrich bookmarks with:

* Page titles
* Favicons
* OpenGraph images (when allowed by CORS)

Failures are expected and non-fatal.

If a preview cannot be fetched, the bookmark still works.

---

## Architecture Overview

* **Frontend**: Vanilla JS + TypeScript
* **Storage**: IndexedDB (canonical data + cached previews)
* **Routing**: Client-side (one page per board)
* **Hosting**: Static (GitHub Pages, Cloudflare Pages, etc.)

There is no server component.

---

## Project Status

This project is intentionally opinionated and minimalist.

It optimizes for:

* zero operational cost
* long-term maintainability
* user ownership of data

If you need:

* global discovery
* guaranteed previews
* unlimited shared boards

…you probably need infrastructure, and this project explicitly avoids that.

---

## Philosophy

TackTile treats the browser as a **personal tool**, not a thin client for a service.

If you can calculate it again, it does not belong in the URL.
If the user did not explicitly author it, it is not canonical.

Everything else is cache.

---

## License

MIT

