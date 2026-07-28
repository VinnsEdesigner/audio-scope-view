import { StrictMode } from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./global.css";

const rootElement = document.querySelector("#root");
if (!rootElement) throw new Error("Root element not found");

const serverRenderedHtml = rootElement.innerHTML;

if (serverRenderedHtml && serverRenderedHtml.length > 0) {
  hydrateRoot(
    rootElement,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
} else {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
