import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { entryInput, type EntryInput } from "@expense-tracker/shared/schemas";
import { indiaToday } from "@expense-tracker/shared/dates";
import { paiseToRupees, rupeesToPaise } from "@expense-tracker/shared/money";
import * as Haptics from "expo-haptics";
import { z } from "zod";
import { View } from "react-native";
import {
  api,
  errorMessage,
  type Account,
  type Category,
  type Transaction,
} from "./api";
import { displayMerchant, useLookups } from "./display";
import {
  Button,
  display,
  Field,
  Heading,
  Label,
  Row,
  State,
  Title,
} from "./ui";

function daysAgo(today: string, days: number) {
  return new Date(Date.parse(today + "T00:00:00Z") - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const formSchema = z.object({
  ...entryInput.pick({
    type: true,
    date: true,
    accountId: true,
    categoryId: true,
    toAccountId: true,
  }).shape,
  amount: z
    .string()
    .refine(
      (value) => (rupeesToPaise(value) ?? 0) > 0,
      "Enter a positive amount with up to two decimal places.",
    ),
  note: z.string().max(300),
});
type Fields = z.infer<typeof formSchema>;

export function EntryEditor({
  id,
  review,
  close,
}: {
  id?: string;
  review: boolean;
  close: () => void;
}) {
  const entry = useQuery({
    queryKey: ["entry", id],
    queryFn: () => api<Transaction>("/transactions/" + id),
    enabled: !!id,
  });
  const options = useLookups();
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Title>
            {review
              ? "Check transaction"
              : id
                ? "Edit transaction"
                : "Add transaction"}
          </Title>
        </View>
        <Button label="Close without saving" onPress={close}>
          ✕
        </Button>
      </View>
      <State
        pending={options.isPending || (!!id && entry.isPending)}
        error={options.error || entry.error}
        retry={() => {
          void options.refetch();
          if (id) void entry.refetch();
        }}
      />
      {options.data && (!id || entry.data) && (
        <Editor
          key={id ?? "new"}
          item={entry.data}
          review={review}
          close={close}
          {...options.data}
        />
      )}
    </>
  );
}

function Editor({
  item,
  review,
  close,
  accounts,
  categories,
}: {
  item?: Transaction;
  review: boolean;
  close: () => void;
  accounts: Account[];
  categories: Category[];
}) {
  const client = useQueryClient();
  const [always, setAlways] = useState(false);
  const {
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<Fields>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: item ? paiseToRupees(item.amountPaise) : "",
      accountId: item?.accountId ?? accounts[0]?.id ?? "",
      toAccountId: item?.toAccountId ?? null,
      categoryId: item?.categoryId ?? null,
      date: item?.date ?? indiaToday(),
      type: item?.type ?? "expense",
      note: item?.note ?? "",
    },
  });
  const [type, account, to, category] = watch([
    "type",
    "accountId",
    "toAccountId",
    "categoryId",
  ]);
  const save = useMutation({
    mutationFn: async (fields: Fields) => {
      if (
        fields.type === "transfer" &&
        (!fields.toAccountId || fields.accountId === fields.toAccountId)
      ) {
        setError("toAccountId", {
          message: "Choose a different destination account.",
        });
        return false;
      }
      const entry: EntryInput = entryInput.parse({
        ...fields,
        amountPaise: rupeesToPaise(fields.amount),
        tags: item?.tags ?? [],
        categoryId: fields.type === "transfer" ? null : fields.categoryId,
        toAccountId: fields.type === "transfer" ? fields.toAccountId : null,
      });
      if (review && item) {
        await api("/review/" + item.id, "POST", {
          action: "edit",
          entry,
          categoryId: always ? (entry.categoryId ?? undefined) : undefined,
          always,
        });
      } else if (item) await api("/transactions/" + item.id, "PATCH", entry);
      else await api("/transactions", "POST", entry);
      return true;
    },
    onSuccess: (saved) => {
      if (!saved) return;
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
      void client.invalidateQueries();
      close();
    },
  });
  const today = indiaToday();
  const date = watch("date");
  return (
    <>
      {review && item?.merchant && (
        <Label muted>
          From your bank SMS · {displayMerchant(item.merchant)}
        </Label>
      )}
      <Heading>Amount</Heading>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <Field
            accessibilityLabel="Amount in rupees"
            placeholder="₹0"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoFocus={!item}
            keyboardType="decimal-pad"
            style={{ fontFamily: display, fontSize: 32, minHeight: 68 }}
          />
        )}
      />
      <Row>
        {(["expense", "income", "transfer"] as const).map((value) => (
          <Button
            key={value}
            selected={type === value}
            onPress={() => {
              if (type !== value) {
                setValue("type", value);
                setValue("categoryId", null);
                setValue("toAccountId", null);
                setAlways(false);
              }
            }}
          >
            {value.toUpperCase()}
          </Button>
        ))}
      </Row>
      <Heading>{type === "transfer" ? "From account" : "Account"}</Heading>
      {!accounts.length && (
        <Label muted>
          Create an account on the web before adding a transaction.
        </Label>
      )}
      <Row>
        {accounts.map((value) => (
          <Button
            key={value.id}
            selected={account === value.id}
            onPress={() => setValue("accountId", value.id)}
          >
            {value.name}
          </Button>
        ))}
      </Row>
      {type === "transfer" ? (
        <>
          <Heading>To account</Heading>
          <Row>
            {accounts
              .filter((value) => value.id !== account)
              .map((value) => (
                <Button
                  key={value.id}
                  selected={to === value.id}
                  onPress={() => setValue("toAccountId", value.id)}
                >
                  {value.name}
                </Button>
              ))}
          </Row>
        </>
      ) : (
        <>
          <Heading>Category</Heading>
          <Row>
            {categories
              .filter((value) => value.type === type)
              .map((value) => (
                <Button
                  key={value.id}
                  selected={category === value.id}
                  onPress={() => setValue("categoryId", value.id)}
                >
                  {value.name}
                </Button>
              ))}
            <Button
              selected={!category}
              onPress={() => {
                setValue("categoryId", null);
                setAlways(false);
              }}
            >
              Uncategorized
            </Button>
          </Row>
          {review && item?.merchant && (
            <Button
              disabled={!category}
              selected={always}
              label={`Always use this category for ${displayMerchant(item.merchant)}`}
              onPress={() => setAlways(!always)}
            >
              {always ? "✓ " : ""}Always use for{" "}
              {displayMerchant(item.merchant)}
            </Button>
          )}
        </>
      )}
      <Heading>Date</Heading>
      <Row>
        {(
          [
            ["Today", today],
            ["Yesterday", daysAgo(today, 1)],
          ] as const
        ).map(([name, value]) => (
          <Button
            key={name}
            selected={date === value}
            onPress={() => setValue("date", value)}
          >
            {name}
          </Button>
        ))}
      </Row>
      <Controller
        control={control}
        name="date"
        render={({ field }) => (
          <Field
            accessibilityLabel="Other date, year-month-day"
            placeholder="Other date: YYYY-MM-DD"
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        )}
      />
      <Heading>Note (optional)</Heading>
      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <Field
            accessibilityLabel="Note"
            placeholder="What was it for?"
            value={field.value}
            onChangeText={field.onChange}
            maxLength={300}
          />
        )}
      />
      {Object.entries(errors).map(([name, error]) => (
        <Label key={name} error>
          {error.message}
        </Label>
      ))}
      {save.error && <Label error>{errorMessage(save.error)}</Label>}
      <Button
        variant="primary"
        disabled={!accounts.length || save.isPending}
        onPress={() => void handleSubmit((fields) => save.mutate(fields))()}
      >
        {save.isPending ? "SAVING…" : review ? "SAVE AND APPROVE" : "SAVE"}
      </Button>
    </>
  );
}
