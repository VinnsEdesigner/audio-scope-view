import { createBrowserRouter } from "react-router-dom";
import { Root } from "./root";
import { Dashboard, ScopeList, ScopeDetail, Settings } from "./routes";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
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
    ],
  },
]);
