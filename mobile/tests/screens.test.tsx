import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { auth } from "../src/auth";
import { api } from "../src/api";
import { Dashboard } from "../src/ledger";
import { SignIn } from "../src/sign-in";
import { SmsScreen } from "../src/sms-screen";
import { bankSms, useSmsStatus } from "../src/bank-sms";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  return ({ children }: { children: React.ReactNode }) => children;
});
jest.mock("../src/auth", () => ({
  auth: { signIn: { email: jest.fn() }, signUp: { email: jest.fn() } },
}));
jest.mock("../src/api", () => ({
  api: jest.fn(),
  errorMessage: (error: Error) => error.message,
}));
jest.mock("../src/bank-sms", () => ({
  bankSms: { requestPermissions: jest.fn(), getStatus: jest.fn() },
  useSmsStatus: jest.fn(),
}));

const client = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });

test("shows totals, review count and an empty recent-transactions state", async () => {
  jest.mocked(api).mockResolvedValue({
    currency: "INR",
    expensePaise: 10000,
    incomePaise: 30000,
    netPaise: 20000,
    balancePaise: 90000,
    netWorthPaise: 120000,
    reviewCount: 2,
    budgets: [],
    latest: [],
  });
  const review = jest.fn();
  await render(
    <QueryClientProvider client={client()}>
      <Dashboard edit={jest.fn()} review={review} />
    </QueryClientProvider>,
  );
  expect(await screen.findByLabelText("Spent ₹100.00")).toBeOnTheScreen();
  expect(
    screen.getByText(
      "No transactions yet. Tap + to add one, or import bank SMS.",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", { name: "REVIEW 2 NEW TRANSACTIONS" }),
  );
  expect(review).toHaveBeenCalledTimes(1);
});

test("signs in with email and tells the session to refresh", async () => {
  const submit = jest.mocked(auth.signIn.email);
  submit.mockResolvedValue({ error: null } as Awaited<
    ReturnType<typeof submit>
  >);
  const refresh = jest.fn();
  await render(<SignIn onSuccess={refresh} />);
  await fireEvent.changeText(
    screen.getByLabelText("Email"),
    "test@example.com",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Password"),
    "test-password",
  );
  await fireEvent.press(screen.getByRole("button", { name: "SIGN IN" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(submit).toHaveBeenCalledWith({
    email: "test@example.com",
    password: "test-password",
  });
});

test("asks for Android permission after showing the disclosure and offers paste on denial", async () => {
  const denied = {
    readPermission: false,
    receivePermission: false,
    batteryOptimized: false,
    queueSize: 0,
    lastSent: null,
    revoked: false,
    deviceId: "test",
    ownerId: "test",
    baseUrl: "https://ledger.example",
    senders: ["*-HDFCBK"],
    lastError: null,
  };
  jest.mocked(useSmsStatus).mockReturnValue({
    data: denied,
    isPending: false,
    error: null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useSmsStatus>);
  jest.mocked(bankSms.getStatus).mockResolvedValue(denied);
  await render(
    <QueryClientProvider client={client()}>
      <SmsScreen reconnect={jest.fn()} />
    </QueryClientProvider>,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "SMS PERMISSIONS" }),
  );
  expect(screen.getByText("Before you enable SMS")).toBeOnTheScreen();
  expect(bankSms.requestPermissions).toHaveBeenCalledTimes(0);
  await fireEvent.press(
    screen.getByRole("button", { name: "CONTINUE TO ANDROID PERMISSIONS" }),
  );
  expect(await screen.findByLabelText("Bank SMS text")).toBeOnTheScreen();
  expect(bankSms.requestPermissions).toHaveBeenCalledTimes(1);
});
