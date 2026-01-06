import { onRequest } from "firebase-functions/v2/https";

/**
 * Fetch metadata from a URL.
 * This bypasses CORS since it runs server-side.
 */
export const fetchMetadata = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    const url = req.query.url || req.body?.url;

    if (!url) {
      res.status(400).json({ error: "Missing url parameter" });
      return;
    }

    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        res.status(400).json({ error: "Invalid URL protocol" });
        return;
      }

      // Fetch the page
      const response = await fetch(url, {
        headers: {
          "User-Agent": "TackTile/1.0 (Bookmark Preview Fetcher)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        res.status(502).json({ error: `Failed to fetch: ${response.status}` });
        return;
      }

      const html = await response.text();
      const metadata = parseMetadata(html, url);

      res.json(metadata);
    } catch (error) {
      console.error("Fetch error:", error);
      res.status(502).json({ error: "Failed to fetch URL" });
    }
  }
);

/**
 * Parse metadata from HTML.
 */
function parseMetadata(html, pageUrl) {
  const result = {
    title: null,
    siteName: null,
    description: null,
    ogImageUrl: null,
    faviconUrl: `${new URL(pageUrl).origin}/favicon.ico`,
  };

  // Extract title
  const ogTitleMatch = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  result.title = ogTitleMatch?.[1] || titleMatch?.[1] || null;

  // Extract site name
  const siteNameMatch = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
  );
  result.siteName = siteNameMatch?.[1] || null;

  // Extract description
  const ogDescMatch = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
  );
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  );
  result.description = ogDescMatch?.[1] || descMatch?.[1] || null;

  // Extract OG image
  const ogImageMatch = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogImageMatch?.[1]) {
    let imageUrl = ogImageMatch[1];
    // Make relative URLs absolute
    if (!imageUrl.startsWith("http")) {
      try {
        imageUrl = new URL(imageUrl, pageUrl).href;
      } catch {
        imageUrl = null;
      }
    }
    result.ogImageUrl = imageUrl;
  }

  // Try to find a better favicon
  const iconMatch = html.match(
    /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i
  );
  if (iconMatch?.[1]) {
    let iconUrl = iconMatch[1];
    if (!iconUrl.startsWith("http")) {
      try {
        iconUrl = new URL(iconUrl, pageUrl).href;
      } catch {
        // Keep default favicon
      }
    }
    result.faviconUrl = iconUrl;
  }

  return result;
}
