// Dashboard screen — entry point. Components were removed during the RN
// port (stubs deleted); this is a minimal shell until the web-aligned
// components are written. Shows the local-session list + sync status when
// persistenceMode === "local" (server-optional local mode, impl spec Step 8).
import * as React from "react";
import { View, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useSettingsStore } from "./store/settings-store";
import { useLocalSessions } from "./hooks/use-local-sessions";
import { useLocalSessionStore } from "./store/local-session-store";

function LocalSessionList() {
  const { sessions, loading, error, create } = useLocalSessions();
  const syncStatus = useLocalSessionStore((s) => s.syncStatus);
  const lastSyncedAt = useLocalSessionStore((s) => s.lastSyncedAt);

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-tertiary text-xs uppercase tracking-widest">
          Local Sessions
        </Text>
        <Text className="text-text-tertiary text-xs">
          sync: {syncStatus}
          {lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString()}` : ""}
        </Text>
      </View>

      <Pressable
        onPress={() => void create({ name: `Session ${sessions.length + 1}` })}
        className="bg-blue-600 rounded-md p-2 items-center"
      >
        <Text className="text-white">New Local Session</Text>
      </Pressable>

      {loading && <ActivityIndicator color="#60a5fa" />}

      {error ? (
        <Text className="text-red-400 text-xs">{error}</Text>
      ) : null}

      {sessions.length === 0 && !loading ? (
        <Text className="text-text-tertiary text-xs">No sessions yet.</Text>
      ) : null}

      {sessions.map((s) => (
        <View key={s.id} className="border border-zinc-700 rounded-md p-3 gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-primary text-sm font-medium">
              {s.name ?? "Untitled"}
            </Text>
            <Text className="text-text-tertiary text-xs">
              {s.serverDirty ? "● pending sync" : "✓ synced"}
            </Text>
          </View>
          <Text className="text-text-tertiary text-xs">
            {new Date(s.startedAt).toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function IndexScreen() {
  const persistenceMode = useSettingsStore((s) => s.persistenceMode);

  return (
    <ScrollView className="flex-1 bg-bg-primary" contentContainerClassName="p-6 gap-6">
      <View className="items-center gap-2">
        <Text className="text-text-primary text-2xl font-bold">Vyzorix</Text>
        <Text className="text-text-secondary text-sm">
          Mobile audio scope — C++ DSP via JSI
        </Text>
      </View>

      <View className="flex-row gap-3">
        <Link href="/scope" asChild>
          <Pressable className="flex-1 bg-blue-600 rounded-md p-3 items-center">
            <Text className="text-white">Open Scope</Text>
          </Pressable>
        </Link>
        <Link href="/settings" asChild>
          <Pressable className="flex-1 border border-zinc-600 rounded-md p-3 items-center">
            <Text className="text-text-primary">Settings</Text>
          </Pressable>
        </Link>
      </View>

      {persistenceMode === "local" ? <LocalSessionList /> : null}
    </ScrollView>
  );
}
