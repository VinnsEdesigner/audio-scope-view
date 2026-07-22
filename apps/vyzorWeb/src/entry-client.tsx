import { StrictMode } from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./global.css";

// Get the root element
const rootElement = document.querySelector("#root");
if (!rootElement) throw new Error("Root element not found");

/**
 * Hydrate the app for SSR
 * If the server rendered HTML exists, we hydrate it.
 * Otherwise, we do a full client-side render (SPA mode).
 */
const serverRenderedHtml = rootElement.innerHTML;

// SSR Hydration mode
if (serverRenderedHtml && serverRenderedHtml.length > 0) {
  // App was server-rendered, hydrate it
  hydrateRoot(
    rootElement,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
} else {
  // SPA mode - no server rendering, do full client render
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
