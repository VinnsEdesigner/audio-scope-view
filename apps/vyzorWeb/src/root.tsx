import { ApolloProvider } from "@apollo/client";
import { Outlet } from "react-router-dom";
import { useUIStore } from "./hooks";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider, Theme } from "tamagui";
import { useEffect } from "react";
import { TopNav } from "./components/layout/top-nav";
import { ToastProvider } from "./components/ui/toast";
import { NavigationLoader } from "./components/ui/navigation-loader";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { Spinner } from "./components/ui/spinner";
import { SessionSelectionProvider } from "./contexts/session-selection-context";

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
  const isInitializing = useUIStore((state) => state.isInitializing);
  const setInitializing = useUIStore((state) => state.setInitializing);

  useEffect(() => {
    // Simulate app initialization (replace with actual initialization logic)
    // For production, this should be replaced with actual app readiness checks
    const timer = setTimeout(() => {
      setInitializing(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [setInitializing]);

  return (
    <div className="flex flex-1 h-screen bg-bg-primary">
      {/* Always show TopNav - loading bar overlays it */}
      <TopNav />
      <div className="flex flex-col flex-1 overflow-hidden bg-bg-primary min-h-0">
        <Outlet />
      </div>
    </div>
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
      <SessionSelectionProvider>
        <AppShell />
      </SessionSelectionProvider>
    </Theme>
  );
}

export function Root() {
  const apolloClient = graphqlClient as unknown as ApolloClient<NormalizedCacheObject>;

  return (
    <ApolloProvider client={apolloClient}>
      <TamaguiProvider config={tamaguiConfig}>
        <NavigationLoader />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seoData) }}
        />
        <ToastProvider>
          <ThemedApp />
        </ToastProvider>
      </TamaguiProvider>
    </ApolloProvider>
  );
}

export { AppShell };
