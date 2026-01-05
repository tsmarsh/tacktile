import type {
  Id,
  Board,
  Bookmark,
  BookmarkMetadata,
  BookmarkThumbnail,
} from './types';

const DB_NAME = 'tacktile';
const DB_VERSION = 1;

// Store names
const BOARDS = 'boards';
const BOOKMARKS = 'bookmarks';
const METADATA = 'metadata';
const THUMBNAILS = 'thumbnails';

let dbInstance: IDBDatabase | null = null;

/**
 * Generate a random ID for new entities.
 */
export function generateId(): Id {
  return crypto.randomUUID();
}

/**
 * Open and initialize the database.
 * Creates object stores if they don't exist.
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Canonical data stores
      if (!db.objectStoreNames.contains(BOARDS)) {
        db.createObjectStore(BOARDS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(BOOKMARKS)) {
        const bookmarkStore = db.createObjectStore(BOOKMARKS, { keyPath: 'id' });
        bookmarkStore.createIndex('boardId', 'boardId', { unique: false });
      }

      // Derived data stores (cache, disposable)
      if (!db.objectStoreNames.contains(METADATA)) {
        db.createObjectStore(METADATA, { keyPath: 'bookmarkId' });
      }

      if (!db.objectStoreNames.contains(THUMBNAILS)) {
        db.createObjectStore(THUMBNAILS, { keyPath: 'bookmarkId' });
      }
    };
  });
}

// =============================================================================
// Board Operations
// =============================================================================

export async function createBoard(name: string): Promise<Board> {
  const db = await openDB();
  const board: Board = {
    id: generateId(),
    name,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOARDS, 'readwrite');
    const store = tx.objectStore(BOARDS);
    const request = store.add(board);

    request.onsuccess = () => resolve(board);
    request.onerror = () => reject(request.error);
  });
}

export async function getBoard(id: Id): Promise<Board | undefined> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOARDS, 'readonly');
    const store = tx.objectStore(BOARDS);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllBoards(): Promise<Board[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOARDS, 'readonly');
    const store = tx.objectStore(BOARDS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateBoard(board: Board): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOARDS, 'readwrite');
    const store = tx.objectStore(BOARDS);
    const request = store.put(board);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBoard(id: Id): Promise<void> {
  const db = await openDB();

  // Delete all bookmarks in the board first
  const bookmarks = await getBookmarksByBoard(id);
  for (const bookmark of bookmarks) {
    await deleteBookmark(bookmark.id);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOARDS, 'readwrite');
    const store = tx.objectStore(BOARDS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// =============================================================================
// Bookmark Operations
// =============================================================================

export async function createBookmark(
  url: string,
  boardId: Id,
  notes?: string,
  tags?: string[]
): Promise<Bookmark> {
  const db = await openDB();
  const bookmark: Bookmark = {
    id: generateId(),
    url,
    boardId,
    addedAt: Date.now(),
    notes,
    tags,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKMARKS, 'readwrite');
    const store = tx.objectStore(BOOKMARKS);
    const request = store.add(bookmark);

    request.onsuccess = () => resolve(bookmark);
    request.onerror = () => reject(request.error);
  });
}

export async function getBookmark(id: Id): Promise<Bookmark | undefined> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKMARKS, 'readonly');
    const store = tx.objectStore(BOOKMARKS);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getBookmarksByBoard(boardId: Id): Promise<Bookmark[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKMARKS, 'readonly');
    const store = tx.objectStore(BOOKMARKS);
    const index = store.index('boardId');
    const request = index.getAll(boardId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateBookmark(bookmark: Bookmark): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKMARKS, 'readwrite');
    const store = tx.objectStore(BOOKMARKS);
    const request = store.put(bookmark);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBookmark(id: Id): Promise<void> {
  const db = await openDB();

  // Delete associated metadata and thumbnail
  await deleteMetadata(id);
  await deleteThumbnail(id);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKMARKS, 'readwrite');
    const store = tx.objectStore(BOOKMARKS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// =============================================================================
// Metadata Operations (Derived/Cached Data)
// =============================================================================

export async function saveMetadata(metadata: BookmarkMetadata): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA, 'readwrite');
    const store = tx.objectStore(METADATA);
    const request = store.put(metadata);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMetadata(bookmarkId: Id): Promise<BookmarkMetadata | undefined> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA, 'readonly');
    const store = tx.objectStore(METADATA);
    const request = store.get(bookmarkId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMetadata(bookmarkId: Id): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA, 'readwrite');
    const store = tx.objectStore(METADATA);
    const request = store.delete(bookmarkId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// =============================================================================
// Thumbnail Operations (Derived/Cached Data)
// =============================================================================

export async function saveThumbnail(thumbnail: BookmarkThumbnail): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THUMBNAILS, 'readwrite');
    const store = tx.objectStore(THUMBNAILS);
    const request = store.put(thumbnail);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getThumbnail(bookmarkId: Id): Promise<BookmarkThumbnail | undefined> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THUMBNAILS, 'readonly');
    const store = tx.objectStore(THUMBNAILS);
    const request = store.get(bookmarkId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteThumbnail(bookmarkId: Id): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THUMBNAILS, 'readwrite');
    const store = tx.objectStore(THUMBNAILS);
    const request = store.delete(bookmarkId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear all derived/cached data (metadata and thumbnails).
 * Canonical data (boards and bookmarks) is preserved.
 */
export async function clearCache(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([METADATA, THUMBNAILS], 'readwrite');

    tx.objectStore(METADATA).clear();
    tx.objectStore(THUMBNAILS).clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
