import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { View } from "react-native";
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
import { Button, Label, Row, Screen, State, usePalette } from "../src/ui";

type Tab = "Dashboard" | "Transactions" | "Review" | "SMS" | "Settings";
const tabs: Tab[] = ["Dashboard", "Transactions", "Review", "SMS", "Settings"];

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
      <Screen refresh={!editor ? refresh : undefined} refreshing={refreshing}>
        {!editor && (
          <Row>
            {tabs.map((item) => (
              <Button
                key={item}
                selected={tab === item}
                onPress={() => setTab(item)}
              >
                {item.toUpperCase()}
              </Button>
            ))}
          </Row>
        )}
        {sms.data?.revoked && tab !== "SMS" && (
          <Button onPress={() => setTab("SMS")}>
            Device revoked: sign in again
          </Button>
        )}
        {connectError && (
          <>
            <Label error>{errorMessage(connectError)}</Label>
            <Button disabled={connecting} onPress={() => connect()}>
              RETRY DEVICE REGISTRATION
            </Button>
          </>
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
              <SmsScreen reconnect={() => signOut.mutate(true)} />
            )}
            {tab === "Settings" && (
              <Settings
                email={user.email}
                signOut={() => signOut.mutate(false)}
              />
            )}
          </>
        )}
        {!editor && <View style={{ height: 54 }} />}
      </Screen>
      {!editor && (
        <View style={{ position: "absolute", right: 20, bottom: 32 }}>
          <Button
            selected
            label="Quick add transaction"
            onPress={() => setEditor({ review: false })}
          >
            +
          </Button>
        </View>
      )}
    </View>
  );
}
