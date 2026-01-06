import type { Id, BookmarkMetadata } from './types';
import * as db from './db';

// Firebase Function URL - will be set after deployment
const METADATA_FUNCTION_URL = 'https://us-central1-tacktyl.cloudfunctions.net/fetchMetadata';

/**
 * Fetch metadata for a bookmark via Firebase Function.
 * Falls back to basic favicon if the function fails.
 * Returns the metadata if successful.
 */
export async function fetchMetadata(bookmarkId: Id, url: string): Promise<BookmarkMetadata | null> {
  try {
    const response = await fetch(
      `${METADATA_FUNCTION_URL}?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      await saveFallbackMetadata(bookmarkId, getFaviconUrl(url));
      return null;
    }

    const data = await response.json();

    const metadata: BookmarkMetadata = {
      bookmarkId,
      title: data.title || undefined,
      siteName: data.siteName || undefined,
      faviconUrl: data.faviconUrl || getFaviconUrl(url),
      ogImageUrl: data.ogImageUrl || undefined,
      fetchedAt: Date.now(),
    };

    await db.saveMetadata(metadata);
    return metadata;
  } catch {
    // Function unavailable or error - save fallback silently
    try {
      await saveFallbackMetadata(bookmarkId, getFaviconUrl(url));
    } catch {
      // Ignore
    }
    return null;
  }
}

/**
 * Save minimal fallback metadata when we can't fetch the page.
 */
async function saveFallbackMetadata(bookmarkId: Id, faviconUrl: string): Promise<void> {
  const existing = await db.getMetadata(bookmarkId);
  if (!existing) {
    await db.saveMetadata({
      bookmarkId,
      faviconUrl,
      fetchedAt: Date.now(),
    });
  }
}

/**
 * Derive favicon URL from a page URL.
 */
function getFaviconUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  return `${url.origin}/favicon.ico`;
}

/**
 * Queue metadata fetching for a bookmark.
 * Runs in the background, non-blocking.
 * Optional callback is invoked with the metadata when ready.
 */
export function queueMetadataFetch(
  bookmarkId: Id,
  url: string,
  onComplete?: (metadata: BookmarkMetadata | null) => void
): void {
  setTimeout(async () => {
    const metadata = await fetchMetadata(bookmarkId, url);
    onComplete?.(metadata);
  }, 0);
}
