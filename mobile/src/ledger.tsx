import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatMoney, type Currency } from "@expense-tracker/shared/money";
import { View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  api,
  errorMessage,
  page,
  type Dashboard as DashboardData,
  type Transaction,
} from "./api";
import {
  accent,
  Button,
  Card,
  Field,
  Label,
  Row,
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
}: {
  item: Transaction;
  currency: Currency;
  open?: () => void;
}) {
  const description = item.merchant || item.note || item.type;
  const source = ["sms", "email", "pdf", "cas"].includes(item.source)
    ? item.source.toUpperCase()
    : "MANUAL";
  const amount = item.type === "expense" ? -item.amountPaise : item.amountPaise;
  const text =
    description + " · " + formatMoney(amount, currency) + " [" + source + "]";
  return open ? (
    <Button label={"Edit " + text} onPress={open}>
      {text}
    </Button>
  ) : (
    <Label>{text}</Label>
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
  return (
    <>
      <Title>Dashboard</Title>
      <State
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {data && (
        <>
          <Card>
            <Label>{"// THIS MONTH"}</Label>
            <Label>SPENT {formatMoney(data.expensePaise, data.currency)}</Label>
            <Label>INCOME {formatMoney(data.incomePaise, data.currency)}</Label>
            <Label>NET {formatMoney(data.netPaise, data.currency)}</Label>
          </Card>
          <Card>
            <Label>{"// TOTAL BALANCE"}</Label>
            <Label>{formatMoney(data.balancePaise, data.currency)}</Label>
            <Label>{"// NET WORTH"}</Label>
            <Label>{formatMoney(data.netWorthPaise, data.currency)}</Label>
          </Card>
          <Button selected onPress={review}>
            REVIEW ({data.reviewCount})
          </Button>
          <Label>{"// BUDGETS"}</Label>
          {data.budgets.length === 0 && <Label>No budgets this month.</Label>}
          {data.budgets.map((budget) => (
            <Card key={budget.id}>
              <Label>
                {budget.name} · {formatMoney(budget.spentPaise, data.currency)}{" "}
                / {formatMoney(budget.limitPaise, data.currency)}
              </Label>
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
          <Label>{"// LAST 5 TRANSACTIONS"}</Label>
          {data.latest.length === 0 && <Label>No transactions yet.</Label>}
          {data.latest.map((item) => (
            <EntryLine
              key={item.id}
              item={item}
              currency={data.currency}
              open={() => edit(item.id)}
            />
          ))}
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
        placeholder="Search transactions"
        value={search}
        onChangeText={setSearch}
        maxLength={80}
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
        <Row>
          <Label>Transaction deleted.</Label>
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
      )}
      {query.isSuccess && entries.length === 0 && (
        <Label>
          {search ? "No matching transactions." : "No transactions yet."}
        </Label>
      )}
      {entries.map((item, index) => (
        <View key={item.id} style={{ gap: 8 }}>
          {item.date !== entries[index - 1]?.date && (
            <Label>
              {"// "}
              {item.date}
            </Label>
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
            <View
              accessible={false}
              accessibilityActions={[
                { name: "delete", label: "Delete transaction" },
              ]}
              onAccessibilityAction={(event) => {
                if (
                  event.nativeEvent.actionName === "delete" &&
                  !remove.isPending
                )
                  remove.mutate(item.id);
              }}
            >
              <EntryLine
                item={item}
                currency={currency}
                open={() => edit(item.id)}
              />
            </View>
          </Swipeable>
        </View>
      ))}
      {query.hasNextPage && (
        <Button
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "LOADING…" : "LOAD MORE"}
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
  return (
    <>
      <Title>Review queue</Title>
      <State
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {decide.error && <Label error>{errorMessage(decide.error)}</Label>}
      {query.isSuccess && !items.length && <Label>Nothing to review.</Label>}
      {items.map((item) => (
        <Card key={item.id}>
          <EntryLine item={item} currency={currency} />
          <Label>
            {item.date}
            {item.confidence === null
              ? ""
              : " · " + item.confidence + "% confidence"}
          </Label>
          <Row>
            <Button
              disabled={decide.isPending}
              onPress={() => decide.mutate({ id: item.id, action: "approve" })}
            >
              APPROVE
            </Button>
            <Button onPress={() => edit(item.id)}>EDIT</Button>
            <Button
              disabled={decide.isPending}
              onPress={() => decide.mutate({ id: item.id, action: "reject" })}
            >
              REJECT
            </Button>
          </Row>
        </Card>
      ))}
      {query.hasNextPage && (
        <Button
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "LOADING…" : "LOAD MORE"}
        </Button>
      )}
    </>
  );
}
