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

  // Extract best image from multiple sources (in priority order)
  result.ogImageUrl = findBestImage(html, pageUrl);

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

/**
 * Find the best image from multiple sources.
 * Priority: og:image > twitter:image > link[rel=image_src] > large content images
 */
function findBestImage(html, pageUrl) {
  const candidates = [];

  // 1. Open Graph image (highest priority)
  const ogImageMatch = html.match(
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i
  ) || html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i
  );
  if (ogImageMatch?.[1]) {
    candidates.push({ url: ogImageMatch[1], priority: 1 });
  }

  // 2. Twitter card image
  const twitterImageMatch = html.match(
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i
  ) || html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i
  );
  if (twitterImageMatch?.[1]) {
    candidates.push({ url: twitterImageMatch[1], priority: 2 });
  }

  // 3. Link rel="image_src" (older convention)
  const linkImageMatch = html.match(
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  );
  if (linkImageMatch?.[1]) {
    candidates.push({ url: linkImageMatch[1], priority: 3 });
  }

  // 4. Schema.org image
  const schemaImageMatch = html.match(
    /"image"\s*:\s*"([^"]+)"/i
  );
  if (schemaImageMatch?.[1] && schemaImageMatch[1].startsWith('http')) {
    candidates.push({ url: schemaImageMatch[1], priority: 4 });
  }

  // 5. Find large images in content (look for images with width/height attributes or in main content)
  const imgMatches = html.matchAll(
    /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  );
  for (const match of imgMatches) {
    const imgTag = match[0];
    const src = match[1];

    // Skip tiny images, icons, tracking pixels, data URIs
    if (src.startsWith('data:')) continue;
    if (/\b(icon|logo|avatar|emoji|badge|button|sprite|tracking|pixel|1x1)\b/i.test(imgTag)) continue;
    if (/\b(icon|logo|avatar|emoji|badge|button|sprite)\b/i.test(src)) continue;

    // Look for size hints
    const widthMatch = imgTag.match(/width=["']?(\d+)/i);
    const heightMatch = imgTag.match(/height=["']?(\d+)/i);
    const width = widthMatch ? parseInt(widthMatch[1]) : 0;
    const height = heightMatch ? parseInt(heightMatch[1]) : 0;

    // Prefer larger images
    if (width >= 200 || height >= 200) {
      candidates.push({ url: src, priority: 5, size: width * height });
    } else if (width === 0 && height === 0) {
      // No size specified - might be a content image, lower priority
      candidates.push({ url: src, priority: 6 });
    }
  }

  // Sort by priority, then by size for same priority
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.size || 0) - (a.size || 0);
  });

  // Return the best candidate, making URL absolute if needed
  for (const candidate of candidates) {
    let imageUrl = candidate.url;
    if (!imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, pageUrl).href;
      } catch {
        continue; // Invalid URL, try next
      }
    }
    return imageUrl;
  }

  return null;
}
