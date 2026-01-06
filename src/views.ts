import type { Board, Bookmark } from './types';
import * as db from './db';
import { navigate } from './router';
import { exportBoard, exportToFile, importFromFile } from './share';

/**
 * Get the app container element.
 */
function getApp(): HTMLElement {
  const app = document.getElementById('app');
  if (!app) throw new Error('App container not found');
  return app;
}

/**
 * Clear the app container.
 */
function clear(): void {
  getApp().innerHTML = '';
}

// =============================================================================
// Board List View (Home Page)
// =============================================================================

export async function renderBoardList(): Promise<void> {
  clear();
  const app = getApp();

  const boards = await db.getAllBoards();

  const header = document.createElement('header');
  header.innerHTML = `
    <h1>TackTile</h1>
    <div>
      <button id="import-btn">Import</button>
      <button id="new-board-btn">+ New Board</button>
    </div>
  `;
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee;';
  app.appendChild(header);

  const btnStyle = 'padding: 0.5rem 1rem; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;';

  const importBtn = document.getElementById('import-btn')!;
  importBtn.style.cssText = btnStyle.replace('#0066cc', '#28a745');
  importBtn.addEventListener('click', showImportDialog);

  const newBoardBtn = document.getElementById('new-board-btn')!;
  newBoardBtn.style.cssText = btnStyle;
  newBoardBtn.addEventListener('click', showNewBoardDialog);

  const container = document.createElement('main');
  container.style.cssText = 'padding: 1rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;';
  app.appendChild(container);

  if (boards.length === 0) {
    container.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No boards yet. Create one to get started!</p>';
    return;
  }

  for (const board of boards) {
    const card = createBoardCard(board);
    container.appendChild(card);
  }
}

function createBoardCard(board: Board): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; padding: 1rem; cursor: pointer; transition: box-shadow 0.2s;';
  card.innerHTML = `
    <h3 style="margin-bottom: 0.5rem;">${escapeHtml(board.name)}</h3>
    <p style="color: #666; font-size: 0.875rem;">Created ${formatDate(board.createdAt)}</p>
  `;
  card.addEventListener('mouseenter', () => {
    card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.boxShadow = 'none';
  });
  card.addEventListener('click', () => {
    navigate(`/board/${board.id}`);
  });
  return card;
}

function showNewBoardDialog(): void {
  const name = prompt('Enter board name:');
  if (name && name.trim()) {
    db.createBoard(name.trim()).then(() => {
      renderBoardList();
    });
  }
}

function showImportDialog(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (file) {
      try {
        const boardId = await importFromFile(file);
        navigate(`/board/${boardId}`);
      } catch (e) {
        alert('Failed to import: ' + (e instanceof Error ? e.message : 'Unknown error'));
      }
    }
  });
  input.click();
}

// =============================================================================
// Board Detail View
// =============================================================================

export async function renderBoardDetail(boardId: string): Promise<void> {
  clear();
  const app = getApp();

  const board = await db.getBoard(boardId);
  if (!board) {
    renderNotFound();
    return;
  }

  const bookmarks = await db.getBookmarksByBoard(boardId);

  const header = document.createElement('header');
  header.innerHTML = `
    <div>
      <a href="#/" id="back-link" style="text-decoration: none; color: #0066cc;">← Boards</a>
      <h1 style="margin-top: 0.5rem;">${escapeHtml(board.name)}</h1>
    </div>
    <div>
      <button id="share-btn">Share</button>
      <button id="add-bookmark-btn">+ Add Bookmark</button>
    </div>
  `;
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem; border-bottom: 1px solid #eee;';
  app.appendChild(header);

  const btnStyle = 'padding: 0.5rem 1rem; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;';

  const shareBtn = document.getElementById('share-btn')!;
  shareBtn.style.cssText = btnStyle.replace('#0066cc', '#28a745');
  shareBtn.addEventListener('click', () => showShareDialog(boardId));

  const addBtn = document.getElementById('add-bookmark-btn')!;
  addBtn.style.cssText = btnStyle;
  addBtn.addEventListener('click', () => showAddBookmarkDialog(boardId));

  const container = document.createElement('main');
  container.style.cssText = 'padding: 1rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;';
  app.appendChild(container);

  if (bookmarks.length === 0) {
    container.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No bookmarks yet. Add one to get started!</p>';
    return;
  }

  for (const bookmark of bookmarks) {
    const tile = createBookmarkTile(bookmark, boardId);
    container.appendChild(tile);
  }
}

function createBookmarkTile(bookmark: Bookmark, boardId: string): HTMLElement {
  const tile = document.createElement('div');
  tile.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;';

  // Placeholder for thumbnail - will be enhanced later with metadata fetching
  const preview = document.createElement('div');
  preview.style.cssText = 'height: 120px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; color: #999;';
  preview.textContent = new URL(bookmark.url).hostname;
  tile.appendChild(preview);

  const content = document.createElement('div');
  content.style.cssText = 'padding: 0.75rem;';

  const link = document.createElement('a');
  link.href = bookmark.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = bookmark.url;
  link.style.cssText = 'display: block; font-size: 0.875rem; color: #0066cc; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
  content.appendChild(link);

  if (bookmark.notes) {
    const notes = document.createElement('p');
    notes.textContent = bookmark.notes;
    notes.style.cssText = 'margin-top: 0.5rem; font-size: 0.875rem; color: #666;';
    content.appendChild(notes);
  }

  const meta = document.createElement('p');
  meta.textContent = `Added ${formatDate(bookmark.addedAt)}`;
  meta.style.cssText = 'margin-top: 0.5rem; font-size: 0.75rem; color: #999;';
  content.appendChild(meta);

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.cssText = 'margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;';
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('Delete this bookmark?')) {
      await db.deleteBookmark(bookmark.id);
      renderBoardDetail(boardId);
    }
  });
  content.appendChild(deleteBtn);

  tile.appendChild(content);
  return tile;
}

function showAddBookmarkDialog(boardId: string): void {
  const url = prompt('Enter URL:');
  if (url && url.trim()) {
    try {
      new URL(url.trim()); // Validate URL
      const notes = prompt('Notes (optional):') || undefined;
      db.createBookmark(url.trim(), boardId, notes).then(() => {
        renderBoardDetail(boardId);
      });
    } catch {
      alert('Invalid URL');
    }
  }
}

async function showShareDialog(boardId: string): Promise<void> {
  try {
    const result = await exportBoard(boardId);

    if ('error' in result) {
      // Board is too large for URL sharing
      const downloadFile = confirm(
        'This board is too large to share via URL. Would you like to download it as a file instead?'
      );
      if (downloadFile) {
        await exportToFile(boardId);
      }
      return;
    }

    // Copy URL to clipboard
    await navigator.clipboard.writeText(result.url);
    alert('Share link copied to clipboard!');
  } catch (e) {
    alert('Failed to share: ' + (e instanceof Error ? e.message : 'Unknown error'));
  }
}

// =============================================================================
// Not Found View
// =============================================================================

export function renderNotFound(): void {
  clear();
  const app = getApp();
  app.innerHTML = `
    <div style="padding: 2rem; text-align: center;">
      <h1>404 - Not Found</h1>
      <p style="margin-top: 1rem;"><a href="#/">Go to Home</a></p>
    </div>
  `;
}

// =============================================================================
// Utilities
// =============================================================================

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}
