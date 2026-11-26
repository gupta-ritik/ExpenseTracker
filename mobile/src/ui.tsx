import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  type PressableProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const accent = "#D4FF00";
export const mono = "JetBrainsMono_400Regular";
export const display = "ArchivoBlack_400Regular";

export function usePalette() {
  return useColorScheme() === "dark"
    ? { bg: "#0A0A0A", fg: "#F2EFE6", danger: "#FF9A89", muted: "#BCB8AA" }
    : { bg: "#F2EFE6", fg: "#0A0A0A", danger: "#A22218", muted: "#4E4B44" };
}

export function Label({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  const { fg, danger } = usePalette();
  return (
    <Text
      accessibilityLiveRegion={error ? "polite" : "none"}
      style={[styles.label, { color: error ? danger : fg }]}
    >
      {children}
    </Text>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const { fg } = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: fg }]}>
      {children}
    </Text>
  );
}

export function Button({
  children,
  onPress,
  selected,
  disabled,
  label,
  ...actionProps
}: {
  children: ReactNode;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
} & Pick<PressableProps, "accessibilityActions" | "onAccessibilityAction">) {
  const { bg, fg } = usePalette();
  return (
    <View style={styles.offset}>
      <View style={[styles.shadow, { backgroundColor: fg }]} />
      <Pressable
        {...actionProps}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: selected ? accent : bg,
            borderColor: fg,
            opacity: disabled ? 0.55 : 1,
            transform: pressed ? [{ translateX: 3 }, { translateY: 3 }] : [],
          },
        ]}
      >
        <Text style={[styles.label, { color: selected ? "#0A0A0A" : fg }]}>
          {children}
        </Text>
      </Pressable>
    </View>
  );
}

export function Field({ accessibilityLabel, ...props }: TextInputProps) {
  const { fg, muted } = usePalette();
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={muted}
      {...props}
      style={[styles.input, { color: fg, borderColor: fg }, props.style]}
    />
  );
}

export function Card({ children }: { children: ReactNode }) {
  const { bg, fg } = usePalette();
  return (
    <View style={styles.offset}>
      <View style={[styles.shadow, { backgroundColor: fg }]} />
      <View style={[styles.card, { backgroundColor: bg, borderColor: fg }]}>
        {children}
      </View>
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">{children}</View>
  );
}

export function Screen({
  children,
  refresh,
  refreshing = false,
}: {
  children: ReactNode;
  refresh?: () => void;
  refreshing?: boolean;
}) {
  const { bg, fg } = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.screen}
        refreshControl={
          refresh && (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={fg}
            />
          )
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function State({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: Error | null;
  retry: () => void;
}) {
  const { fg } = usePalette();
  if (pending)
    return <ActivityIndicator color={fg} accessibilityLabel="Loading" />;
  if (!error) return null;
  return (
    <>
      <Label error>{error.message}</Label>
      <Button onPress={retry}>Retry</Button>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18, gap: 16, paddingBottom: 40 },
  label: { fontFamily: mono, fontSize: 14, lineHeight: 21 },
  title: { fontFamily: display, fontSize: 31 },
  offset: { marginRight: 3, marginBottom: 3 },
  shadow: { position: "absolute", top: 3, left: 3, right: -3, bottom: -3 },
  card: { borderWidth: 2, padding: 12, gap: 9 },
  button: {
    borderWidth: 2,
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    minHeight: 48,
    borderWidth: 2,
    padding: 10,
    fontFamily: mono,
    fontSize: 16,
  },
});
