import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../src/auth";
import { errorMessage } from "../src/api";
import {
  disconnectBankSms,
  registerDevice,
  useSmsStatus,
} from "../src/bank-sms";
import { EntryEditor } from "../src/entry-form";
import { Dashboard, Review, Transactions, useDashboard } from "../src/ledger";
import { Settings } from "../src/settings";
import { SignIn } from "../src/sign-in";
import { SmsScreen } from "../src/sms-screen";
import {
  Button,
  Label,
  Screen,
  State,
  TabBar,
  tabBarHeight,
  usePalette,
} from "../src/ui";

type Tab = "Dashboard" | "Transactions" | "Review" | "SMS" | "Settings";
const tabs = [
  { key: "Dashboard", label: "Home" },
  { key: "Transactions", label: "Activity" },
  { key: "Review", label: "Review" },
  { key: "SMS", label: "SMS" },
  { key: "Settings", label: "Settings" },
] as const satisfies readonly { key: Tab; label: string }[];

export default function Index() {
  const session = auth.useSession();
  if (session.isPending || session.error)
    return (
      <Screen>
        <State
          pending={session.isPending}
          error={session.error ? new Error(session.error.message) : null}
          retry={() => void session.refetch()}
        />
      </Screen>
    );
  if (!session.data) return <SignIn onSuccess={() => void session.refetch()} />;
  return (
    <UserLedger
      key={session.data.user.id}
      user={session.data.user}
      refreshSession={() => void session.refetch()}
    />
  );
}

function UserLedger(props: {
  user: { id: string; email: string };
  refreshSession: () => void;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Ledger {...props} />
    </QueryClientProvider>
  );
}

function Ledger({
  user,
  refreshSession,
}: {
  user: { id: string; email: string };
  refreshSession: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [editor, setEditor] = useState<{ id?: string; review: boolean }>();
  const [refreshing, setRefreshing] = useState(false);
  const client = useQueryClient();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const dashboard = useDashboard();
  const sms = useSmsStatus();
  const signOut = useMutation({
    mutationFn: async (keepQueue: boolean) => {
      if (!keepQueue) await disconnectBankSms();
      const result = await auth.signOut();
      if (result.error)
        throw new Error(result.error.message ?? "Sign-out failed.");
      client.clear();
      refreshSession();
    },
  });
  const {
    mutate: connect,
    error: connectError,
    isPending: connecting,
  } = useMutation({
    mutationFn: () => registerDevice(user.id),
    // Connecting happens in the background; retry quietly before showing an error.
    retry: 3,
    retryDelay: (attempt) => 2000 * 2 ** attempt,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["sms-status"] });
      void client.invalidateQueries({ queryKey: ["devices"] });
    },
  });
  useEffect(() => {
    connect();
  }, [connect]);
  const edit = (id: string) => setEditor({ id, review: tab === "Review" });
  const currency = dashboard.data?.currency ?? "INR";

  function refresh() {
    setRefreshing(true);
    void client.invalidateQueries().finally(() => setRefreshing(false));
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen
        refresh={!editor ? refresh : undefined}
        refreshing={refreshing}
        bottomInset={editor ? 40 : 96}
      >
        {sms.data?.revoked && tab !== "SMS" && !editor && (
          <Button onPress={() => setTab("SMS")}>
            SMS CAPTURE STOPPED · FIX
          </Button>
        )}
        {signOut.error && <Label error>{errorMessage(signOut.error)}</Label>}
        {editor ? (
          <EntryEditor {...editor} close={() => setEditor(undefined)} />
        ) : (
          <>
            {tab === "Dashboard" && (
              <Dashboard edit={edit} review={() => setTab("Review")} />
            )}
            {tab === "Transactions" && (
              <Transactions edit={edit} currency={currency} />
            )}
            {tab === "Review" && <Review edit={edit} currency={currency} />}
            {tab === "SMS" && (
              <SmsScreen
                reconnect={() => signOut.mutate(true)}
                connection={{
                  error: connectError ? errorMessage(connectError) : null,
                  connecting,
                  retry: () => connect(),
                }}
              />
            )}
            {tab === "Settings" && (
              <Settings
                email={user.email}
                signOut={() => signOut.mutate(false)}
              />
            )}
          </>
        )}
      </Screen>
      {!editor && (
        <>
          <View
            style={{
              position: "absolute",
              right: 18,
              bottom: tabBarHeight + insets.bottom + 14,
            }}
          >
            <Button
              variant="primary"
              label="Add transaction"
              onPress={() => setEditor({ review: false })}
            >
              + ADD
            </Button>
          </View>
          <TabBar
            tabs={tabs}
            active={tab}
            onChange={setTab}
            badges={{
              Review: dashboard.data?.reviewCount,
              SMS: connectError || sms.data?.revoked ? "!" : undefined,
            }}
          />
        </>
      )}
    </View>
  );
}
