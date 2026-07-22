import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { useIsMobile, useUIStore } from "./hooks";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider, Stack, Theme } from "tamagui";
import { useEffect } from "react";

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

function ThemedApp() {
  const theme = useUIStore((state) => state.theme);
  
  // Determine actual theme based on setting
  const resolvedTheme = theme === "system" 
    ? (globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  // Apply theme to document body for CSS variable access
  useEffect(() => {
    document.body.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  return (
    <Theme name={resolvedTheme}>
      <AppShell />
    </Theme>
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
        <ThemedApp />
      </QueryClientProvider>
    </TamaguiProvider>
  );
}

export { AppShell };
