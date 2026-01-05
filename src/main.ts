import { addRoute, onNotFound, startRouter } from './router';
import { renderBoardList, renderBoardDetail, renderNotFound } from './views';

// Set up routes
addRoute('/', () => {
  renderBoardList();
});

addRoute('/board/:id', (params) => {
  renderBoardDetail(params.id);
});

onNotFound(() => {
  renderNotFound();
});

// Start the router
startRouter();
