import { createBrowserRouter } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Root } from "./root";
import { PageLoader } from "@/components/page-loader";

const Home = lazy(() => import("./routes/home").then((m) => ({ default: m.Home })));
const Session = lazy(() => import("./routes/session").then((m) => ({ default: m.Session })));
const Settings = lazy(() => import("./routes/settings").then((m) => ({ default: m.Settings })));
const ApiKeys = lazy(() => import("./routes/api-keys").then((m) => ({ default: m.ApiKeys })));
const CreateApiKey = lazy(() =>
  import("./routes/api-keys.create").then((m) => ({ default: m.CreateApiKey })),
);
const ScopePage = lazy(() => import("./routes/scope-page").then((m) => ({ default: m.ScopePage })));
const About = lazy(() => import("./routes/about").then((m) => ({ default: m.About })));
const ReportIssue = lazy(() =>
  import("./routes/report-issue").then((m) => ({ default: m.ReportIssue })),
);
const ContactSupport = lazy(() =>
  import("./routes/contact-support").then((m) => ({ default: m.ContactSupport })),
);
const Legal = lazy(() => import("./routes/legal").then((m) => ({ default: m.Legal })));

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
        element: <Home />,
      },
      {
        path: "/session/:sessionId",
        element: <Session />,
      },
      {
        path: "/oscilloscope",
        element: <ScopePage />,
      },
      {
        path: "/settings",
        element: <Settings />,
      },
      {
        path: "/api-keys",
        element: <ApiKeys />,
      },
      {
        path: "/api-keys/new",
        element: <CreateApiKey />,
      },
      {
        path: "/about",
        element: <About />,
      },
      {
        path: "/report-issue",
        element: <ReportIssue />,
      },
      {
        path: "/contact-support",
        element: <ContactSupport />,
      },
      {
        path: "/legal",
        element: <Legal />,
      },
    ],
  },
]);

export const routeTree = {
  path: "/",
  children: [
    { path: "/", element: "Home" },
    { path: "/session/:sessionId", element: "Session" },
    { path: "/oscilloscope", element: "Oscilloscope" },
    { path: "/settings", element: "Settings" },
    { path: "/api-keys", element: "ApiKeys" },
    { path: "/api-keys/new", element: "CreateApiKey" },
    { path: "/about", element: "About" },
    { path: "/report-issue", element: "ReportIssue" },
    { path: "/contact-support", element: "ContactSupport" },
    { path: "/legal", element: "Legal" },
  ],
};
