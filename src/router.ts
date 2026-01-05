/**
 * Simple hash-based router for client-side navigation.
 * Routes use the format: /#/path
 */

export type RouteParams = Record<string, string>;

export interface Route {
  /** Route pattern, e.g., '/board/:id' */
  pattern: string;
  /** Handler function called when route matches */
  handler: (params: RouteParams) => void;
}

interface ParsedRoute {
  regex: RegExp;
  paramNames: string[];
  handler: (params: RouteParams) => void;
}

let routes: ParsedRoute[] = [];
let notFoundHandler: (() => void) | null = null;

/**
 * Convert a route pattern like '/board/:id' to a regex.
 */
function parsePattern(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  // Escape special regex characters except for :param patterns
  const regexStr = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

  return {
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
  };
}

/**
 * Register a route with its handler.
 */
export function addRoute(pattern: string, handler: (params: RouteParams) => void): void {
  const { regex, paramNames } = parsePattern(pattern);
  routes.push({ regex, paramNames, handler });
}

/**
 * Register a handler for when no routes match.
 */
export function onNotFound(handler: () => void): void {
  notFoundHandler = handler;
}

/**
 * Get the current path from the URL hash.
 */
export function getCurrentPath(): string {
  const hash = window.location.hash;
  // Remove leading '#' and return the path
  return hash.startsWith('#') ? hash.slice(1) : '/';
}

/**
 * Navigate to a new path by updating the hash.
 */
export function navigate(path: string): void {
  window.location.hash = path;
}

/**
 * Replace the current path without adding to history.
 * Used for import URLs that should be consumed immediately.
 */
export function replaceRoute(path: string): void {
  window.history.replaceState(null, '', `#${path}`);
  // Manually trigger routing since replaceState doesn't fire hashchange
  handleRoute();
}

/**
 * Match the current path against registered routes and invoke the handler.
 */
function handleRoute(): void {
  const path = getCurrentPath();

  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params: RouteParams = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      route.handler(params);
      return;
    }
  }

  // No route matched
  if (notFoundHandler) {
    notFoundHandler();
  }
}

/**
 * Initialize the router and start listening for hash changes.
 */
export function startRouter(): void {
  window.addEventListener('hashchange', handleRoute);
  // Handle initial route
  handleRoute();
}

/**
 * Stop the router and remove event listeners.
 */
export function stopRouter(): void {
  window.removeEventListener('hashchange', handleRoute);
}

/**
 * Clear all registered routes.
 * Useful for testing.
 */
export function clearRoutes(): void {
  routes = [];
  notFoundHandler = null;
}
