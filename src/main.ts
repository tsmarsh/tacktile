import { addRoute, onNotFound, startRouter, replaceRoute } from './router';
import { renderBoardList, renderBoardDetail, renderNotFound } from './views';
import { importBoard } from './share';

// Set up routes
addRoute('/', () => {
  renderBoardList();
});

addRoute('/board/:id', (params) => {
  renderBoardDetail(params.id);
});

addRoute('/import/:payload', async (params) => {
  try {
    const boardId = await importBoard(params.payload);
    // Replace URL without adding to history (per ADR)
    replaceRoute(`/board/${boardId}`);
  } catch (e) {
    alert('Failed to import board: ' + (e instanceof Error ? e.message : 'Unknown error'));
    replaceRoute('/');
  }
});

onNotFound(() => {
  renderNotFound();
});

// Start the router
startRouter();
