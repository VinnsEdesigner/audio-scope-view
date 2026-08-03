import { ApolloProvider } from "@apollo/client";
import { Outlet } from "react-router-dom";
import { useUIStore } from "./hooks";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider, Theme } from "tamagui";
import { useEffect, useState } from "react";
import { TopNav } from "./components/layout/top-nav";
import { ToastProvider } from "./components/ui/toast";
import { NavigationLoader } from "./components/ui/navigation-loader";
import { graphqlClient } from "@audio-scope-view/api-client/audioScopeView/graphql";
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client";
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 10_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-1 h-screen bg-bg-primary">
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="w-12 h-12 md:w-20 md:h-20" size={48} />
        </div>
      ) : (
        <>
          <TopNav />
          <div className="flex flex-col flex-1 overflow-hidden bg-bg-primary min-h-0">
            <Outlet />
          </div>
        </>
      )}
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
      <AppShell />
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
