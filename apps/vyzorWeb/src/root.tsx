import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { useIsMobile, useUIStore } from "./hooks";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider, Theme, YStack, XStack } from "tamagui";
import { useEffect, useState } from "react";
import { AppSidebar, TopBar } from "./components/layout";

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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <YStack flex={1} height="100vh" backgroundColor="$gray1">
      <TopBar showMenu={isMobile} onMenuToggle={() => setMobileOpen((v) => !v)} />
      <XStack flex={1} overflow="hidden" position="relative">
        {!isMobile && <AppSidebar />}
        {isMobile && mobileOpen && (
          <>
            <YStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              backgroundColor="rgba(0,0,0,0.35)"
              zIndex={40}
              onPress={() => setMobileOpen(false)}
            />
            <YStack
              position="absolute"
              top={0}
              left={0}
              bottom={0}
              zIndex={50}
              onPress={() => setMobileOpen(false)}
            >
              <AppSidebar />
            </YStack>
          </>
        )}
        <YStack flex={1} overflow="auto" backgroundColor="$gray1">
          <Outlet />
        </YStack>
      </XStack>
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
        <ThemedApp />
      </QueryClientProvider>
    </TamaguiProvider>
  );
}

export { AppShell };
