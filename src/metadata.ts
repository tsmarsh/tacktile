import type { Id, BookmarkMetadata } from './types';
import * as db from './db';

/**
 * Attempt to fetch metadata for a bookmark.
 * This is best-effort only - failures are silent and non-blocking.
 * CORS will block most requests, which is expected and acceptable.
 */
export async function fetchMetadata(bookmarkId: Id, url: string): Promise<void> {
  try {
    // Try to fetch the page with no-cors mode first for favicon
    // This won't give us page content but we can derive favicon URL
    const faviconUrl = getFaviconUrl(url);

    // Try to actually fetch the page (will fail for most sites due to CORS)
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      // Save what we can (just favicon)
      await saveFallbackMetadata(bookmarkId, faviconUrl);
      return;
    }

    const html = await response.text();
    const metadata = parseMetadata(html, url);
    metadata.bookmarkId = bookmarkId;
    metadata.faviconUrl = faviconUrl;

    await db.saveMetadata(metadata);
  } catch {
    // CORS blocked or network error - save fallback metadata silently
    try {
      await saveFallbackMetadata(bookmarkId, getFaviconUrl(url));
    } catch {
      // Even fallback failed - ignore silently
    }
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
 * Uses the standard /favicon.ico path which is widely supported.
 */
function getFaviconUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  return `${url.origin}/favicon.ico`;
}

/**
 * Parse metadata from HTML content.
 */
function parseMetadata(html: string, pageUrl: string): BookmarkMetadata {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Get title from og:title or <title>
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const titleTag = doc.querySelector('title')?.textContent;
  const title = ogTitle || titleTag || undefined;

  // Get site name from og:site_name
  const siteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || undefined;

  // Get OG image
  let ogImageUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined;

  // Make relative URLs absolute
  if (ogImageUrl && !ogImageUrl.startsWith('http')) {
    try {
      ogImageUrl = new URL(ogImageUrl, pageUrl).href;
    } catch {
      ogImageUrl = undefined;
    }
  }

  return {
    bookmarkId: '', // Will be set by caller
    title,
    siteName,
    ogImageUrl,
    fetchedAt: Date.now(),
  };
}

/**
 * Queue metadata fetching for a bookmark.
 * Runs in the background, non-blocking.
 */
export function queueMetadataFetch(bookmarkId: Id, url: string): void {
  // Use setTimeout to ensure it doesn't block the main thread
  setTimeout(() => {
    fetchMetadata(bookmarkId, url);
  }, 0);
}
