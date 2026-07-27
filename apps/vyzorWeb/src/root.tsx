import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { useUIStore } from "./hooks";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider, Theme, YStack } from "tamagui";
import { useEffect } from "react";
import { TopNav } from "./components/layout/top-nav";
import { ToastProvider } from "./components/ui/toast";

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
  return (
    <YStack flex={1} height="100vh" backgroundColor="$gray1">
      {/* Top Navigation with hamburger - overlays content for edge-to-edge pages */}
      <TopNav />
      {/* Main content area - full width/height, TopNav overlays on top */}
      <YStack flex={1} overflow="auto" backgroundColor="$gray1">
        <Outlet />
      </YStack>
    </YStack>
  );
}

function ThemedApp() {
  const theme = useUIStore((state) => state.theme);
  const waveformColor = useUIStore((state) => state.waveformColor);
  
  // Determine actual theme based on setting
  const resolvedTheme = theme === "system" 
    ? (globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  // Apply theme to document html element for CSS variable access
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  // Apply waveform color to document html element for CSS variable access
  useEffect(() => {
    document.documentElement.setAttribute("data-waveform-color", waveformColor);
  }, [waveformColor]);

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
        <ToastProvider>
          <ThemedApp />
        </ToastProvider>
      </QueryClientProvider>
    </TamaguiProvider>
  );
}

export { AppShell };
