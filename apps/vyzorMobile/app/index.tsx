// Dashboard screen — entry point. Components were removed during the RN
// port (stubs deleted); this is a minimal shell until the web-aligned
// components are written. Navigation only.
import * as React from "react";
import { View, ScrollView, Pressable, Text } from "react-native";
import { Link } from "expo-router";

export default function IndexScreen() {
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
    </ScrollView>
  );
}
