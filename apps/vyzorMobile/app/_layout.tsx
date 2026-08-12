// Root layout — Expo Router. Wraps the app in SafeAreaProvider + TanStack
// Query provider + ApolloProvider (the ported transport hooks read from
// Apollo context). The Apollo client is built once after ensureDeviceId()
// resolves so the X-Device-Id header is present on every request. NativeWind
// className support is global (babel preset + metro plugin); no provider needed.
import "../global.css";
import * as React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApolloProvider } from "@apollo/client";
import { buildApolloClient, ensureDeviceId } from "./lib/apollo-client";
import { useSettingsStore } from "./store/settings-store";
import { useLocalSync } from "./hooks/use-local-sync";

const queryClient = new QueryClient();

/**
 * Mounts the local→server sync drain only when persistenceMode === "local".
 * Rendered inside ApolloProvider so the sync hook can issue mutations.
 * Renders nothing — it is a side-effect gate.
 */
function LocalSyncGate() {
  const persistenceMode = useSettingsStore((s) => s.persistenceMode);
  useLocalSync(persistenceMode === "local");
  return null;
}

export default function RootLayout() {
  const [client, setClient] = React.useState<ReturnType<typeof buildApolloClient> | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    void ensureDeviceId().then(() => {
      if (!cancelled) setClient(buildApolloClient());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!client) {
    // Until the device id is loaded + the Apollo client is built, the
    // transport hooks have no client to read from. Render a bare shell so the
    // splash doesn't crash; screens gate on their own loading state.
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <ApolloProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <LocalSyncGate />
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#1a1a1d" },
              headerTintColor: "#f5f5f7",
              contentStyle: { backgroundColor: "#1a1a1d" },
            }}
          >
            <Stack.Screen name="index" options={{ title: "Dashboard" }} />
            <Stack.Screen name="scope" options={{ title: "Scope" }} />
            <Stack.Screen name="settings" options={{ title: "Settings" }} />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ApolloProvider>
  );
}
