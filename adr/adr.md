# ADR-0001: Local‑First Bookmarking Architecture (Minimal Infra)

**Status**: Accepted
**Date**: 2026‑01‑05
**Decision Makers**: Project Owner, Coding Agent

---

## Context

We are building a bookmarking site inspired by Pinterest, but with an explicit constraint:

> **Avoid ongoing infrastructure costs while retaining a rich, visual bookmarking UX.**

The core data being stored is a **list of URLs**, optionally grouped into boards. All other information (thumbnails, titles, previews, metadata) can be *derived* from those URLs.

Early exploration considered URL‑hash storage patterns (e.g. textarea.my). While attractive for zero‑infra sharing, this approach breaks down for:

* scale
* mobile browsers (especially iOS Safari)
* binary data (thumbnails)

Additionally, browser security constraints (CORS) prevent reliable client‑side scraping of link metadata, making server‑side preview generation expensive and undesirable.

---

## Decision

### 1. **Canonical data is minimal and user‑authored only**

Only data that **cannot be deterministically recalculated** is treated as canonical:

* URL
* Board membership
* Added timestamp
* User notes / tags (optional)

This data is small, stable, and portable.

---

### 2. **All derived data is local‑only and disposable**

Derived or enrichable data is stored **only in local browser storage** and may be regenerated or discarded at any time:

* Page title
* Site name
* Favicon URL
* OpenGraph image URL (best‑effort)
* Generated thumbnails (image blobs)
* Fetch timestamps, ETags, cache version

This includes *all* visual richness.

---

### 3. **IndexedDB is the primary storage layer**

* Canonical bookmark data is stored in IndexedDB
* Thumbnail images and metadata blobs are stored in IndexedDB
* localStorage is reserved strictly for lightweight UI state

Rationale:

* IndexedDB supports structured data and blobs
* No size issues at realistic bookmark scales
* Offline‑first by default

---

### 4. **URLs are not used as a long-term data store**

URLs are treated as **navigation and identity**. Long-lived state is not encoded directly into shareable URLs because of browser length limits and mobile instability.

Acceptable URL usage:

* Board identifiers (navigation)
* Item identifiers (navigation)
* **One-time import payloads** (e.g., compressed board JSON) used only to bootstrap local state

If an import payload is present in the URL, the app **must consume it immediately**, persist canonical data to IndexedDB, and then **replace the URL** with the normal board route.

---

### 5. **Local‑first UX with progressive enhancement**

Bookmark creation is immediate:

1. Save URL → persist canonical data
2. Render placeholder card instantly
3. Background agent attempts metadata fetch
4. If allowed (CORS‑permitting), cache metadata and thumbnail
5. UI updates opportunistically

Failures are silent and non‑blocking.

---

### 6. **CORS is treated as a hard constraint, not a problem to defeat**

* No attempt is made to bypass CORS in the client
* Metadata fetching is best‑effort only
* Rich previews are *optional*, not guaranteed

Future enhancement paths (explicitly deferred):

* Optional user‑hosted preview helper
* Bring‑your‑own preview provider
* Manual thumbnail upload by the user

---

### 7. **Architecture supports future sync without migration pain**

By keeping canonical data minimal and cleanly separated from derived cache:

* A future sync layer can store *only* canonical data
* Local caches remain rebuildable
* No schema rewrite is required to add:

  * BYO cloud storage
  * Tiny backend index
  * Public sharing or discovery

---

## Consequences

### Positive

* Near-zero infrastructure cost
* Offline-first by default
* No server-side scraping or image hosting
* Avoids long-lived URL bloat and browser instability
* Clean mental model for agents and maintainers

### Negative / Trade-offs

* No guaranteed thumbnails for all links
* Visual richness varies by site and browser policy
* Public discovery requires future infra
* Sharing large boards requires either:

  * one-time import URLs (fragile on mobile for big payloads), or
  * a minimal **URL shortener** / payload store

These trade-offs are intentional and aligned with the project goals.

---

## Sharing Strategy (No Backend, Link-Based)

We explicitly choose:

1. **No backend we control**
2. **Sharing via link**

Therefore, **board sharing uses URL-encoded payloads** and carries an intentional, hard size ceiling.

### Share link format

* Export a board as a compact canonical payload (URLs + user-authored tags/notes only)
* Compress (deflate-raw) and base64url-encode
* Produce a link such as:

  * `/#/import/<payload>`

### Import semantics

* On app load, if an import payload is present:

  1. decode + decompress
  2. persist canonical data to IndexedDB
  3. compute a local `boardId`
  4. **replace** the URL with the normal board route (do not keep the long payload in history)

### Size limits and UX

* Enforce a strict max payload size (client-side) to protect mobile browsers
* When a board exceeds the limit, the UI must offer alternatives that remain backend-free:

  * export to file (JSON)
  * copy export text for manual transfer

Non-goal:

* Unlimited-size boards via link without any persistence service

---

## Summary (for the Coding Agent)

* Treat URLs as *identity*, never storage
* Persist only what the user explicitly adds
* Cache everything else locally and assume it can disappear
* Never block UX on metadata fetches
* Respect CORS; do not fight it
* Design storage so future sync is additive, not disruptive

This ADR defines the non‑negotiable architectural boundaries for the project.

