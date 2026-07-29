import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApolloProvider } from "@apollo/client";
import { Outlet } from "react-router-dom";
import { useUIStore } from "./hooks";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider, Theme, YStack } from "tamagui";
import { useEffect } from "react";
import { TopNav } from "./components/layout/top-nav";
import { ToastProvider } from "./components/ui/toast";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";

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
      {}
      <TopNav />
      {}
      <YStack flex={1} overflow="hidden" backgroundColor="$gray1">
        <Outlet />
      </YStack>
    </YStack>
  );
}

function ThemedApp() {
  const theme = useUIStore((state) => state.theme);
  const waveformColor = useUIStore((state) => state.waveformColor);

  const resolvedTheme =
    theme === "system"
      ? globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.dataset.waveformColor = waveformColor;
  }, [waveformColor]);

  return (
    <Theme name={resolvedTheme}>
      <AppShell />
    </Theme>
  );
}

export function Root() {
  // ApolloProvider requires ApolloClient<NormalizedCacheObject>, but due to version
  // mismatches in the monorepo we need to cast
  const apolloClient = graphqlClient as unknown as ApolloClient<NormalizedCacheObject>;

  return (
    <ApolloProvider client={apolloClient}>
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
    </ApolloProvider>
  );
}

export { AppShell };
