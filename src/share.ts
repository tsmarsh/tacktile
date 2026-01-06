import type { ExportPayload, ExportBookmark, Id } from './types';
import * as db from './db';

// Maximum payload size in bytes (to protect mobile browsers)
const MAX_PAYLOAD_SIZE = 8000;

/**
 * Compress a string using deflate-raw.
 */
async function compress(data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(encoder.encode(data));
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Decompress deflate-raw compressed data.
 */
async function decompress(data: Uint8Array): Promise<string> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  const decoder = new TextDecoder();
  return decoder.decode(result);
}

/**
 * Encode bytes to base64url (URL-safe base64).
 */
function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode base64url to bytes.
 */
function fromBase64Url(str: string): Uint8Array {
  // Restore standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Export a board to a shareable URL payload.
 * Returns null if the board is too large.
 */
export async function exportBoard(boardId: Id): Promise<{ url: string } | { error: 'too_large'; json: string }> {
  const board = await db.getBoard(boardId);
  if (!board) {
    throw new Error('Board not found');
  }

  const bookmarks = await db.getBookmarksByBoard(boardId);

  const payload: ExportPayload = {
    name: board.name,
    bookmarks: bookmarks.map((b): ExportBookmark => {
      const exp: ExportBookmark = { url: b.url };
      if (b.notes) exp.notes = b.notes;
      if (b.tags && b.tags.length > 0) exp.tags = b.tags;
      return exp;
    }),
    version: 1,
  };

  const json = JSON.stringify(payload);
  const compressed = await compress(json);
  const encoded = toBase64Url(compressed);

  if (encoded.length > MAX_PAYLOAD_SIZE) {
    return { error: 'too_large', json };
  }

  const url = `${window.location.origin}${window.location.pathname}#/import/${encoded}`;
  return { url };
}

/**
 * Import a board from a URL payload.
 * Returns the created board ID.
 */
export async function importBoard(payload: string): Promise<Id> {
  const compressed = fromBase64Url(payload);
  const json = await decompress(compressed);
  const data = JSON.parse(json) as ExportPayload;

  if (data.version !== 1) {
    throw new Error('Unsupported export version');
  }

  const board = await db.createBoard(data.name);

  for (const bookmark of data.bookmarks) {
    await db.createBookmark(bookmark.url, board.id, bookmark.notes, bookmark.tags);
  }

  return board.id;
}

/**
 * Export a board to a JSON file.
 * Used when the board is too large for URL sharing.
 */
export async function exportToFile(boardId: Id): Promise<void> {
  const board = await db.getBoard(boardId);
  if (!board) {
    throw new Error('Board not found');
  }

  const bookmarks = await db.getBookmarksByBoard(boardId);

  const payload: ExportPayload = {
    name: board.name,
    bookmarks: bookmarks.map((b): ExportBookmark => {
      const exp: ExportBookmark = { url: b.url };
      if (b.notes) exp.notes = b.notes;
      if (b.tags && b.tags.length > 0) exp.tags = b.tags;
      return exp;
    }),
    version: 1,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${board.name.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Import a board from a JSON file.
 */
export async function importFromFile(file: File): Promise<Id> {
  const text = await file.text();
  const data = JSON.parse(text) as ExportPayload;

  if (data.version !== 1) {
    throw new Error('Unsupported export version');
  }

  const board = await db.createBoard(data.name);

  for (const bookmark of data.bookmarks) {
    await db.createBookmark(bookmark.url, board.id, bookmark.notes, bookmark.tags);
  }

  return board.id;
}
