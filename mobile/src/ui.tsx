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
export const monoBold = "JetBrainsMono_700Bold";
export const display = "ArchivoBlack_400Regular";

/** Height of the bottom tab bar, so screens and the add button can clear it. */
export const tabBarHeight = 64;

export function usePalette() {
  return useColorScheme() === "dark"
    ? {
        bg: "#0A0A0A",
        fg: "#F2EFE6",
        danger: "#FF9A89",
        muted: "#BCB8AA",
        income: "#7EE29A",
      }
    : {
        bg: "#F2EFE6",
        fg: "#0A0A0A",
        danger: "#A22218",
        muted: "#4E4B44",
        income: "#1B6E35",
      };
}

export function Label({
  children,
  error = false,
  muted = false,
}: {
  children: ReactNode;
  error?: boolean;
  muted?: boolean;
}) {
  const palette = usePalette();
  return (
    <Text
      accessibilityLiveRegion={error ? "polite" : "none"}
      style={[
        styles.label,
        {
          color: error ? palette.danger : muted ? palette.muted : palette.fg,
        },
      ]}
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

/** Small uppercase section heading. Replaces the old "// SECTION" labels. */
export function Heading({ children }: { children: ReactNode }) {
  const { muted } = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: muted }]}>
      {children}
    </Text>
  );
}

/** Large figure for the one number a card is about. */
export function BigNumber({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  const { fg } = usePalette();
  return (
    <Text
      accessibilityLabel={label}
      adjustsFontSizeToFit
      numberOfLines={1}
      style={[styles.big, { color: fg }]}
    >
      {children}
    </Text>
  );
}

type Variant = "primary" | "secondary" | "quiet";

export function Button({
  children,
  onPress,
  selected,
  disabled,
  label,
  variant,
  ...actionProps
}: {
  children: ReactNode;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  /** primary: lime main action · secondary: outlined · quiet: no shadow. */
  variant?: Variant;
} & Pick<PressableProps, "accessibilityActions" | "onAccessibilityAction">) {
  const { bg, fg, muted } = usePalette();
  const kind: Variant = variant ?? (selected ? "primary" : "secondary");
  const filled = kind === "primary";
  return (
    <View style={kind === "quiet" ? undefined : styles.offset}>
      {kind !== "quiet" && !disabled && (
        <View style={[styles.shadow, { backgroundColor: fg }]} />
      )}
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
            backgroundColor: filled ? accent : bg,
            borderColor: disabled ? muted : fg,
            borderStyle: disabled ? "dashed" : "solid",
            transform:
              pressed && kind !== "quiet"
                ? [{ translateX: 3 }, { translateY: 3 }]
                : [],
          },
          kind === "quiet" && { borderWidth: 0, paddingHorizontal: 8 },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: disabled ? muted : filled ? "#0A0A0A" : fg,
              textDecorationLine:
                kind === "quiet" && !disabled ? "underline" : "none",
            },
          ]}
        >
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

export function Card({
  children,
  highlight = false,
}: {
  children: ReactNode;
  highlight?: boolean;
}) {
  const { bg, fg } = usePalette();
  return (
    <View style={styles.offset}>
      <View style={[styles.shadow, { backgroundColor: fg }]} />
      <View
        style={[
          styles.card,
          { backgroundColor: highlight ? accent : bg, borderColor: fg },
        ]}
      >
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

/** Two values side by side, label above value. */
export function Stat({ label, value }: { label: string; value: string }) {
  const { fg } = usePalette();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Heading>{label}</Heading>
      <Text style={[styles.stat, { color: fg }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * A ledger row: title and detail on the left, amount on the right. Income is
 * green with a plus sign so it never relies on colour alone.
 */
export function ListRow({
  title,
  detail,
  amount,
  income = false,
  onPress,
  label,
  accessibilityActions,
  onAccessibilityAction,
}: {
  title: string;
  detail?: string;
  amount: string;
  income?: boolean;
  onPress?: () => void;
  label?: string;
} & Pick<PressableProps, "accessibilityActions" | "onAccessibilityAction">) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: palette.fg,
          backgroundColor: pressed ? accent : palette.bg,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, { color: palette.fg }]}
        >
          {title}
        </Text>
        {!!detail && (
          <Text
            numberOfLines={1}
            style={[styles.rowDetail, { color: palette.muted }]}
          >
            {detail}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.rowAmount,
          { color: income ? palette.income : palette.fg },
        ]}
      >
        {amount}
      </Text>
    </Pressable>
  );
}

export function Screen({
  children,
  refresh,
  refreshing = false,
  bottomInset = 40,
}: {
  children: ReactNode;
  refresh?: () => void;
  refreshing?: boolean;
  /** Space kept free at the bottom, e.g. for the tab bar and add button. */
  bottomInset?: number;
}) {
  const { bg, fg } = usePalette();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: bg }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.screen, { paddingBottom: bottomInset }]}
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

/** Fixed bottom navigation. The badge shows a count next to a tab name. */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  badges = {},
}: {
  tabs: readonly { key: T; label: string }[];
  active: T;
  onChange: (tab: T) => void;
  /** A count, or "!" for "needs attention". */
  badges?: Partial<Record<T, number | "!" | undefined>>;
}) {
  const { bg, fg } = usePalette();
  return (
    <SafeAreaView
      edges={["bottom"]}
      accessibilityRole="tablist"
      style={{ backgroundColor: bg, borderTopWidth: 2, borderColor: fg }}
    >
      <View style={{ flexDirection: "row", height: tabBarHeight }}>
        {tabs.map((tab) => {
          const selected = tab.key === active;
          const badge = badges[tab.key] || 0;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={
                badge === "!"
                  ? `${tab.label}, needs attention`
                  : badge
                    ? `${tab.label}, ${badge} to review`
                    : tab.label
              }
              onPress={() => onChange(tab.key)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? accent : bg,
                borderLeftWidth: tab === tabs[0] ? 0 : 2,
                borderColor: fg,
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tab,
                  {
                    color: selected ? "#0A0A0A" : fg,
                    fontFamily: selected ? monoBold : mono,
                  },
                ]}
              >
                {tab.label}
              </Text>
              {!!badge && (
                <View style={[styles.badge, { borderColor: fg }]}>
                  <Text style={styles.badgeText}>
                    {typeof badge === "number" && badge > 99 ? "99+" : badge}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
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
      <Button onPress={retry}>RETRY</Button>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18, gap: 16 },
  label: { fontFamily: mono, fontSize: 14, lineHeight: 21 },
  title: { fontFamily: display, fontSize: 30, lineHeight: 38 },
  heading: {
    fontFamily: monoBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  big: { fontFamily: display, fontSize: 40, lineHeight: 50 },
  stat: { fontFamily: monoBold, fontSize: 16, lineHeight: 22 },
  offset: { marginRight: 3, marginBottom: 3 },
  shadow: { position: "absolute", top: 3, left: 3, right: -3, bottom: -3 },
  card: { borderWidth: 2, padding: 14, gap: 10 },
  button: {
    borderWidth: 2,
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    marginTop: -2,
  },
  rowTitle: { fontFamily: monoBold, fontSize: 15, lineHeight: 20 },
  rowDetail: { fontFamily: mono, fontSize: 12, lineHeight: 17 },
  rowAmount: { fontFamily: monoBold, fontSize: 15, lineHeight: 20 },
  tab: { fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderWidth: 2,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: accent, fontFamily: monoBold, fontSize: 10 },
});
