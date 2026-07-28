import { createBrowserRouter } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Root } from "./root";

const Home = lazy(() => import("./routes/home").then((m) => ({ default: m.Home })));
const Settings = lazy(() => import("./routes/settings").then((m) => ({ default: m.Settings })));
const ApiKeys = lazy(() => import("./routes/api-keys").then((m) => ({ default: m.ApiKeys })));
const CreateApiKey = lazy(() =>
 import("./routes/api-keys.create").then((m) => ({ default: m.CreateApiKey })),
);

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
 element: <Home />,
 },
 {
 path: "/scopes",
 element: <Home />,
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
 ],
 },
]);

export const routeTree = {
 path: "/",
 children: [
 { path: "/", element: "Home" },
 { path: "/scopes", element: "Scopes" },
 { path: "/settings", element: "Settings" },
 { path: "/api-keys", element: "ApiKeys" },
 { path: "/api-keys/new", element: "CreateApiKey" },
 ],
};
