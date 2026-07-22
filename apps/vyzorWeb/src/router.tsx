import { createBrowserRouter } from "react-router-dom";
import { Root } from "./root";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      {
        index: true,
        element: <div>Dashboard</div>,
      },
      {
        path: "/scope/:id",
        element: <div>Scope Page</div>,
      },
      {
        path: "/settings",
        element: <div>Settings Page</div>,
      },
    ],
  },
]);
