import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider, Stack } from "tamagui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

/**
 * SSR Render function
 * Renders the app to a string for SSR
 */
export async function render(url: string): Promise<{ html: string; status: number }> {
  try {
    // SSR render with router context for proper hydration
    const html = renderToString(
      <TamaguiProvider config={tamaguiConfig}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </TamaguiProvider>
    );
    return { html, status: 200 };
  } catch (error) {
    console.error("SSR render error:", error);
    return { html: "<h1>500 Internal Server Error</h1>", status: 500 };
  }
}

/**
 * Legacy render function for backwards compatibility
 */
export async function legacyRender(url: string): Promise<string> {
  const { html } = await render(url);
  return html;
}
