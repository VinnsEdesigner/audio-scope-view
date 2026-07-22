import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, RouterProvider } from "react-router-dom";
import { router } from "./router";
import { useIsMobile } from "./hooks";
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

const seoData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Scope View",
  description:
    "Turn your phone's ADC / microphone line into an oscilloscope probe with live HTML5 canvas traces.",
  url: "https://your-domain.com",
  applicationCategory: "DeveloperTool",
  operatingSystem: "Web Browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

function AppShell() {
  const isMobile = useIsMobile();

  return (
    <Stack flex={1}>
      <div className={isMobile ? "mobile-layout" : "desktop-layout"}>
        {!isMobile && <aside className="sidebar">Sidebar</aside>}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </Stack>
  );
}

export function Root() {
  return (
    <TamaguiProvider config={tamaguiConfig}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seoData) }}
      />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </TamaguiProvider>
  );
}

export { AppShell };
