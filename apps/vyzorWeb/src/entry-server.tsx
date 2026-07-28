import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StaticRouter } from "react-router-dom/server";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider } from "tamagui";
import { Root } from "./root";
import { routeTree } from "./router";

const queryClient = new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 60 * 1000,
 retry: 1,
 },
 },
});

export async function render(url: string): Promise<{ html: string; status: number }> {
 try {
 
 const html = renderToString(
 <TamaguiProvider config={tamaguiConfig}>
 <QueryClientProvider client={queryClient}>
 <StaticRouter location={url} basename="/">
 <Root />
 </StaticRouter>
 </QueryClientProvider>
 </TamaguiProvider>,
 );
 return { html, status: 200 };
 } catch (error) {
 console.error("SSR render error:", error);
 return { html: "<h1>500 Internal Server Error</h1>", status: 500 };
 }
}

export async function legacyRender(url: string): Promise<string> {
 const { html } = await render(url);
 return html;
}
