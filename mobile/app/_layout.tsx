import "../global.css";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Label, Screen } from "../src/ui";

export default function Layout() {
  const [ready, error] = useFonts({
    ArchivoBlack_400Regular,
    JetBrainsMono_400Regular,
  });
  if (!ready && !error)
    return (
      <Screen>
        <Label>Loading Expense Tracker…</Label>
      </Screen>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
