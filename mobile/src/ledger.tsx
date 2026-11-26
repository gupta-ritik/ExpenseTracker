import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatMoney, type Currency } from "@expense-tracker/shared/money";
import { Alert, View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  api,
  errorMessage,
  page,
  type Dashboard as DashboardData,
  type Transaction,
} from "./api";
import {
  dateHeading,
  entryDetail,
  entryTitle,
  signedAmount,
  useLookups,
} from "./display";
import {
  accent,
  BigNumber,
  Button,
  Card,
  Field,
  Heading,
  Label,
  ListRow,
  Row,
  Stat,
  State,
  Title,
  usePalette,
} from "./ui";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardData>("/dashboard"),
  });
}

export function EntryLine({
  item,
  currency,
  open,
  remove,
  withDate = false,
}: {
  item: Transaction;
  currency: Currency;
  open?: () => void;
  remove?: () => void;
  withDate?: boolean;
}) {
  const lookups = useLookups();
  const title = entryTitle(item);
  const amount = signedAmount(item, currency);
  const detail = entryDetail(item, lookups.data, withDate);
  return (
    <ListRow
      title={title}
      detail={detail}
      amount={amount}
      income={item.type === "income"}
      onPress={open}
      label={open ? `Edit ${title}, ${amount}, ${detail}` : undefined}
      accessibilityActions={
        remove ? [{ name: "delete", label: "Delete transaction" }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "delete") remove?.();
      }}
    />
  );
}

export function Dashboard({
  edit,
  review,
}: {
  edit: (id: string) => void;
  review: () => void;
}) {
  const query = useDashboard();
  const { fg } = usePalette();
  const data = query.data;
  const month = new Date().toLocaleDateString("en-IN", {
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  return (
    <>
      <Title>Overview</Title>
      <State
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {data && (
        <>
          <Card>
            <Heading>Spent in {month}</Heading>
            <BigNumber
              label={`Spent ${formatMoney(data.expensePaise, data.currency)}`}
            >
              {formatMoney(data.expensePaise, data.currency)}
            </BigNumber>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Stat
                label="Income"
                value={formatMoney(data.incomePaise, data.currency)}
              />
              <Stat
                label="Net"
                value={formatMoney(data.netPaise, data.currency)}
              />
            </View>
          </Card>
          <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 2 }}>
            <Stat
              label="Total balance"
              value={formatMoney(data.balancePaise, data.currency)}
            />
            <Stat
              label="Net worth"
              value={formatMoney(data.netWorthPaise, data.currency)}
            />
          </View>
          {data.reviewCount > 0 && (
            <Button variant="primary" onPress={review}>
              {`REVIEW ${data.reviewCount} NEW ${data.reviewCount === 1 ? "TRANSACTION" : "TRANSACTIONS"}`}
            </Button>
          )}
          <Heading>Budgets</Heading>
          {data.budgets.length === 0 && (
            <Label muted>No budgets this month. Set them on the web.</Label>
          )}
          {data.budgets.map((budget) => (
            <Card key={budget.id}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Label>{budget.name}</Label>
                <Label muted>
                  {formatMoney(budget.spentPaise, data.currency)} of{" "}
                  {formatMoney(budget.limitPaise, data.currency)}
                </Label>
              </View>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={budget.name + " budget used"}
                accessibilityValue={{ text: budget.percent + "%" }}
                style={{ borderWidth: 2, borderColor: fg, height: 14 }}
              >
                <View
                  style={{
                    width: (Math.max(0, Math.min(100, budget.percent)) +
                      "%") as `${number}%`,
                    height: "100%",
                    backgroundColor: accent,
                  }}
                />
              </View>
            </Card>
          ))}
          <Heading>Recent</Heading>
          {data.latest.length === 0 && (
            <Label muted>
              No transactions yet. Tap + to add one, or import bank SMS.
            </Label>
          )}
          <View>
            {data.latest.map((item) => (
              <EntryLine
                key={item.id}
                item={item}
                currency={data.currency}
                withDate
                open={() => edit(item.id)}
              />
            ))}
          </View>
        </>
      )}
    </>
  );
}

export function Transactions({
  edit,
  currency,
}: {
  edit: (id: string) => void;
  currency: Currency;
}) {
  const [search, setSearch] = useState("");
  const client = useQueryClient();
  const [deleted, setDeleted] = useState<{ id: string; undoUntil: string }>();
  const query = useInfiniteQuery({
    queryKey: ["transactions", search.trim()],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      page<Transaction>("/transactions", pageParam, search.trim()),
    getNextPageParam: (last) => last.nextCursor,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; undoUntil: string }>("/transactions/" + id, "DELETE"),
    onSuccess: (result) => {
      setDeleted(result);
      void client.invalidateQueries();
    },
  });
  const undo = useMutation({
    mutationFn: (id: string) => api("/transactions/" + id + "/restore", "POST"),
    onSuccess: () => {
      setDeleted(undefined);
      void client.invalidateQueries();
    },
  });
  const entries = query.data?.pages.flatMap((item) => item.items) ?? [];
  return (
    <>
      <Title>Transactions</Title>
      <Field
        accessibilityLabel="Search transactions"
        placeholder="Search merchant or note"
        value={search}
        onChangeText={setSearch}
        maxLength={80}
        returnKeyType="search"
      />
      <State
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {(remove.error || undo.error) && (
        <Label error>{errorMessage(remove.error || undo.error)}</Label>
      )}
      {deleted && (
        <Card highlight>
          <Row>
            <View style={{ flex: 1 }}>
              <Label>Transaction deleted.</Label>
            </View>
            <Button
              disabled={undo.isPending}
              onPress={() => {
                if (Date.parse(deleted.undoUntil) > Date.now())
                  undo.mutate(deleted.id);
                else setDeleted(undefined);
              }}
            >
              UNDO
            </Button>
          </Row>
        </Card>
      )}
      {query.isSuccess && entries.length === 0 && (
        <Label muted>
          {search
            ? "No transactions match your search."
            : "No transactions yet. Tap + to add one."}
        </Label>
      )}
      {entries.length > 0 && (
        <Label muted>Tap a transaction to edit it. Swipe left to delete.</Label>
      )}
      {entries.map((item, index) => (
        <View key={item.id}>
          {item.date !== entries[index - 1]?.date && (
            <View style={{ paddingTop: index ? 14 : 0, paddingBottom: 8 }}>
              <Heading>{dateHeading(item.date)}</Heading>
            </View>
          )}
          <Swipeable
            renderRightActions={() => (
              <Button
                disabled={remove.isPending}
                label="Delete transaction"
                onPress={() => remove.mutate(item.id)}
              >
                DELETE
              </Button>
            )}
          >
            <EntryLine
              item={item}
              currency={currency}
              open={() => edit(item.id)}
              remove={
                remove.isPending ? undefined : () => remove.mutate(item.id)
              }
            />
          </Swipeable>
        </View>
      ))}
      {query.hasNextPage && (
        <Button
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "LOADING…" : "SHOW OLDER"}
        </Button>
      )}
    </>
  );
}

export function Review({
  edit,
  currency,
}: {
  edit: (id: string) => void;
  currency: Currency;
}) {
  const client = useQueryClient();
  const lookups = useLookups();
  const [progress, setProgress] = useState<string>();
  const query = useInfiniteQuery({
    queryKey: ["review"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => page<Transaction>("/review", pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });
  const decide = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "approve" | "reject";
    }) => api("/review/" + id, "POST", { action }),
    onSuccess: () => void client.invalidateQueries(),
  });
  const items = query.data?.pages.flatMap((result) => result.items) ?? [];
  const approveAll = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const [index, id] of ids.entries()) {
        setProgress(`Approving ${index + 1} of ${ids.length}…`);
        await api("/review/" + id, "POST", { action: "approve" });
      }
    },
    onSettled: () => {
      setProgress(undefined);
      void client.invalidateQueries();
    },
  });
  const busy = decide.isPending || approveAll.isPending;
  function confirmApproveAll() {
    const ids = items.map((item) => item.id);
    Alert.alert(
      `Approve ${ids.length} transactions?`,
      "They move to your ledger as they are. You can still edit them later.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Approve all", onPress: () => approveAll.mutate(ids) },
      ],
    );
  }
  return (
    <>
      <Title>Review</Title>
      <State
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {(decide.error || approveAll.error) && (
        <Label error>{errorMessage(decide.error || approveAll.error)}</Label>
      )}
      {query.isSuccess && !items.length && (
        <Label muted>
          All caught up. New bank SMS that need a check will appear here.
        </Label>
      )}
      {items.length > 1 && (
        <Row>
          <View style={{ flex: 1 }}>
            <Label muted>
              {progress ??
                `${items.length}${query.hasNextPage ? "+" : ""} captured transactions need a check.`}
            </Label>
          </View>
          <Button variant="primary" disabled={busy} onPress={confirmApproveAll}>
            APPROVE ALL
          </Button>
        </Row>
      )}
      {items.map((item) => {
        const title = entryTitle(item);
        const lowConfidence = item.confidence !== null && item.confidence < 80;
        return (
          <Card key={item.id}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Label>{title}</Label>
                <Label muted>{entryDetail(item, lookups.data, true)}</Label>
              </View>
              <Label>{signedAmount(item, currency)}</Label>
            </View>
            {lowConfidence && (
              <Label error>Unsure about this one. Check the details.</Label>
            )}
            <Row>
              <Button
                variant="primary"
                disabled={busy}
                label={`Approve ${title}`}
                onPress={() =>
                  decide.mutate({ id: item.id, action: "approve" })
                }
              >
                ✓ APPROVE
              </Button>
              <Button
                disabled={busy}
                label={`Edit ${title}`}
                onPress={() => edit(item.id)}
              >
                EDIT
              </Button>
              <Button
                variant="quiet"
                disabled={busy}
                label={`Reject ${title}`}
                onPress={() => decide.mutate({ id: item.id, action: "reject" })}
              >
                REJECT
              </Button>
            </Row>
          </Card>
        );
      })}
      {query.hasNextPage && (
        <Button
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "LOADING…" : "SHOW MORE"}
        </Button>
      )}
    </>
  );
}
