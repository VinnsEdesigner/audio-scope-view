import { createBrowserRouter } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Root } from "./root";

// Lazy load route components for code splitting
const Dashboard = lazy(() => import("./routes/_index").then((m) => ({ default: m.Dashboard })));
const ScopeList = lazy(() => import("./routes/scope").then((m) => ({ default: m.ScopeList })));
const ScopeDetail = lazy(() => import("./routes/scope-id").then((m) => ({ default: m.ScopeDetail })));
const Settings = lazy(() => import("./routes/settings").then((m) => ({ default: m.Settings })));
const ApiKeys = lazy(() => import("./routes/api-keys").then((m) => ({ default: m.ApiKeys })));

// Loading fallback component
function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#666",
      }}
    >
      Loading...
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Suspense fallback={<PageLoader />}>
        <Root />
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "/scope",
        element: <ScopeList />,
      },
      {
        path: "/scope/:id",
        element: <ScopeDetail />,
      },
      {
        path: "/settings",
        element: <Settings />,
      },
      {
        path: "/api-keys",
        element: <ApiKeys />,
      },
    ],
  },
]);

/**
 * Route tree for SSR reference
 */
export const routeTree = {
  path: "/",
  children: [
    { path: "/scope", element: "ScopeList" },
    { path: "/scope/:id", element: "ScopeDetail" },
    { path: "/settings", element: "Settings" },
    { path: "/api-keys", element: "ApiKeys" },
  ],
};
