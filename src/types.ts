// =============================================================================
// Canonical Data Types (persisted, minimal, user-authored)
// =============================================================================

/** Unique identifier for boards and bookmarks */
export type Id = string;

/** Unix timestamp in milliseconds */
export type Timestamp = number;

/**
 * A board is a collection of bookmarks.
 * This is canonical data that must be persisted.
 */
export interface Board {
  id: Id;
  name: string;
  createdAt: Timestamp;
}

/**
 * A bookmark is a URL saved to a board.
 * Only canonical (user-authored) data is stored here.
 */
export interface Bookmark {
  id: Id;
  url: string;
  boardId: Id;
  addedAt: Timestamp;
  /** User-provided notes about the bookmark */
  notes?: string;
  /** User-provided tags for categorization */
  tags?: string[];
}

// =============================================================================
// Derived Data Types (local cache only, disposable)
// =============================================================================

/**
 * Cached metadata fetched from the bookmarked URL.
 * This data is derived and can be regenerated or discarded.
 */
export interface BookmarkMetadata {
  bookmarkId: Id;
  /** Page title from <title> or og:title */
  title?: string;
  /** Site name from og:site_name */
  siteName?: string;
  /** Favicon URL */
  faviconUrl?: string;
  /** OpenGraph image URL */
  ogImageUrl?: string;
  /** When this metadata was last fetched */
  fetchedAt: Timestamp;
  /** ETag for cache validation */
  etag?: string;
}

/**
 * Cached thumbnail blob for a bookmark.
 * Stored separately due to size.
 */
export interface BookmarkThumbnail {
  bookmarkId: Id;
  /** The thumbnail image as a Blob */
  blob: Blob;
  /** MIME type of the thumbnail */
  mimeType: string;
  /** When this thumbnail was generated */
  generatedAt: Timestamp;
}

// =============================================================================
// Import/Export Types (for URL-based sharing)
// =============================================================================

/**
 * Minimal bookmark representation for export.
 * Only includes canonical data needed to recreate the bookmark.
 */
export interface ExportBookmark {
  url: string;
  notes?: string;
  tags?: string[];
}

/**
 * Board export payload for URL-based sharing.
 * Kept minimal to fit in URL size limits.
 */
export interface ExportPayload {
  /** Board name */
  name: string;
  /** Array of bookmarks (canonical data only) */
  bookmarks: ExportBookmark[];
  /** Export format version for forward compatibility */
  version: 1;
}
