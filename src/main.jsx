import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { loadContent } from "./content/load-content.js";
import { normalizePath } from "./lib/routing.js";
import "./styles.css";

function appTree(props) {
  return (
    <React.StrictMode>
      <App {...props} />
    </React.StrictMode>
  );
}

export async function bootstrapApp({
  container,
  pathname,
  loadContentImpl = loadContent,
  hydrateRootImpl = hydrateRoot,
  createRootImpl = createRoot,
}) {
  const normalizedPath = normalizePath(pathname);
  const initialPath = normalizedPath ?? pathname;
  let bundle;

  try {
    bundle = await loadContentImpl();
  } catch (initialError) {
    const root = createRootImpl(container);
    root.render(appTree({ initialError, initialPath }));
    return root;
  }

  const tree = appTree({ initialBundle: bundle, initialPath });
  if (normalizedPath !== null && container.dataset.prerenderPath === normalizedPath) {
    return hydrateRootImpl(container, tree);
  }

  const root = createRootImpl(container);
  root.render(tree);
  return root;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  document.documentElement.lang = 'ru';
  const container = document.getElementById('root');
  if (container) {
    void bootstrapApp({ container, pathname: window.location.pathname });
  }
}
