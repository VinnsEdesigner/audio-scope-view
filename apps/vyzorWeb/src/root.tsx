import { ApolloProvider } from "@apollo/client";
import { Outlet } from "react-router-dom";
import { useUIStore } from "./hooks";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider, Theme } from "tamagui";
import { useEffect, useState } from "react";
import { TopNav } from "./components/layout/top-nav";
import { StickyHeader } from "./components/layout/sticky-header";
import { ToastProvider } from "./components/ui/toast";
import { NavigationLoader } from "./components/ui/navigation-loader";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { SessionSelectionProvider } from "./contexts/session-selection-context";
import { HeaderContext, type HeaderContent } from "./contexts/header-context";
import { Spinner } from "./components/ui/spinner";

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
  const _isInitializing = useUIStore((state) => state.isInitializing);
  // Header context state
  const [headerContent, setHeaderContent] = useState<HeaderContent>({
    title: "",
  });

  // Wrap setHeaderContent to match the expected HeaderContext signature
  const handleSetContent = (content: HeaderContent) => {
    setHeaderContent(content);
  };

  return (
    <HeaderContext.Provider value={{ content: headerContent, setContent: handleSetContent }}>
      <div className="flex flex-1 h-screen bg-bg-primary">
        {/* Always show TopNav - loading bar overlays it */}
        <TopNav />
        <div className="flex flex-col flex-1 overflow-hidden bg-bg-primary min-h-0">
          <StickyHeader />
          <Outlet />
        </div>
      </div>
    </HeaderContext.Provider>
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
  const isInitializing = useUIStore((state) => state.isInitializing);
  const setInitializing = useUIStore((state) => state.setInitializing);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Clear the boot splash once the client has mounted. This must live above the
  // splash/app branch, otherwise nothing ever unsets it and the spinner sticks.
  useEffect(() => {
    if (!isHydrated || !isInitializing) return;
    const timer = setTimeout(() => setInitializing(false), 300);
    return () => clearTimeout(timer);
  }, [isHydrated, isInitializing, setInitializing]);

  return (
    <ApolloProvider client={apolloClient}>
      <TamaguiProvider config={tamaguiConfig}>
        {!isHydrated || isInitializing ? (
          <div
            data-app-state="loading"
            data-hydrated={String(isHydrated)}
            data-initializing={String(isInitializing)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-primary"
          >
            <Spinner size={48} className="text-gray-400" />
          </div>
        ) : (
          <div
            data-app-state="ready"
            data-hydrated={String(isHydrated)}
            data-initializing={String(isInitializing)}
          >
            <NavigationLoader />
            <ToastProvider>
              <ThemedApp />
            </ToastProvider>
          </div>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seoData) }}
        />
      </TamaguiProvider>
    </ApolloProvider>
  );
}

export { AppShell };
