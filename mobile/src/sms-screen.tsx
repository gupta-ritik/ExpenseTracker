import { useState } from "react";
import { Linking, Platform } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { isSenderAllowed } from "@expense-tracker/shared/alerts";
import { errorMessage } from "./api";
import { bankSms, useSmsStatus } from "./bank-sms";
import { Button, Card, Field, Heading, Label, Row, State, Title } from "./ui";

/** Where each brand hides "let this app run in the background". */
const batterySteps: [RegExp, string][] = [
  [/xiaomi|redmi|poco/i, "App battery saver → No restrictions"],
  [
    /oppo|realme|oneplus/i,
    "Battery usage → Allow background activity and auto launch",
  ],
  [/vivo|iqoo/i, "Battery → Background power consumption management → Allow"],
  [/samsung/i, "Background usage limits → Never auto sleeping apps"],
];

function manufacturer() {
  const constants = Platform.constants as { Manufacturer?: string };
  return constants.Manufacturer ?? "";
}

export function SmsScreen({
  reconnect,
  connection,
}: {
  reconnect: () => void;
  /** Device registration with the server, run by the app shell. */
  connection?: { error: string | null; connecting: boolean; retry: () => void };
}) {
  const status = useSmsStatus();
  const [explain, setExplain] = useState(false);
  const [paste, setPaste] = useState(false);
  const [showSenders, setShowSenders] = useState(false);
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const action = useMutation({
    mutationFn: async (job: () => Promise<unknown>) => {
      setFeedback("");
      await job();
    },
    onSettled: () => void status.refetch(),
  });
  function run(job: () => Promise<unknown>) {
    action.mutate(job);
  }
  const data = status.data;
  const connected = !!data?.deviceId && !data.revoked && !action.isPending;
  const brand = manufacturer();
  const brandStep = batterySteps.find(([pattern]) => pattern.test(brand))?.[1];
  return (
    <>
      <Title>Bank SMS</Title>
      <State
        pending={status.isPending}
        error={status.error}
        retry={() => void status.refetch()}
      />
      {connection?.error && (
        <Card>
          <Label error>SMS capture isn&apos;t connected to your account.</Label>
          <Label muted>
            New bank SMS are kept on this phone until it connects. Check your
            internet, then try again.
          </Label>
          <Button
            variant="primary"
            disabled={connection.connecting}
            onPress={connection.retry}
          >
            {connection.connecting ? "CONNECTING…" : "CONNECT AGAIN"}
          </Button>
          <Label muted>Details: {connection.error}</Label>
        </Card>
      )}
      {data && (
        <>
          <Card>
            <Heading>Status</Heading>
            <Label>Live capture: {data.receivePermission ? "On" : "Off"}</Label>
            <Label>
              Past SMS import: {data.readPermission ? "Allowed" : "Not allowed"}
            </Label>
            <Label>Waiting to send: {data.queueSize}</Label>
            <Label>
              Last sent:{" "}
              {data.lastSent
                ? new Date(data.lastSent).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Never"}
            </Label>
            {data.revoked && (
              <>
                <Label error>
                  This phone was disconnected. Sign in again to keep capturing.
                </Label>
                <Button variant="primary" onPress={reconnect}>
                  SIGN IN AGAIN
                </Button>
              </>
            )}
            {!data.revoked && data.lastError && (
              <Label error>{data.lastError}</Label>
            )}
            {data.queueSize > 0 && (
              <Row>
                <Button
                  disabled={!connected}
                  onPress={() => run(() => bankSms.retryNow())}
                >
                  SEND NOW
                </Button>
                <Button
                  variant="quiet"
                  disabled={action.isPending}
                  onPress={() => run(() => bankSms.clearQueue())}
                >
                  DISCARD QUEUE
                </Button>
              </Row>
            )}
          </Card>
          {(!data.receivePermission || !data.readPermission) && (
            <>
              <Button onPress={() => setExplain(!explain)}>
                SMS PERMISSIONS
              </Button>
              {!explain && (
                <Button onPress={() => run(() => Linking.openSettings())}>
                  OPEN ANDROID APP SETTINGS
                </Button>
              )}
              {explain && (
                <Card>
                  <Heading>Before you enable SMS</Heading>
                  <Label>
                    The app checks sender IDs on your phone and reads the text
                    of bank alerts only. Inbox access is used only when you
                    start an import.
                  </Label>
                  <Label>
                    Verification messages are discarded. Account and card
                    numbers are masked to their last four digits, and phone
                    numbers, PAN and other identifiers are removed. Payment
                    references are kept for duplicate detection.
                  </Label>
                  <Label>
                    Only masked alerts, sender IDs and timestamps are queued on
                    this phone and sent to the ExpenseTracker server. The server
                    stores parsed transactions. Your device credential is
                    encrypted on Android. Alerts leave the queue after
                    successful delivery.
                  </Label>
                  <Label>
                    Revoke SMS access in Android app settings to stop capture
                    and inbox access. Revoke the device in ExpenseTracker
                    Settings to stop delivery. Discard queue deletes pending
                    alerts. You can delete imported transactions in
                    ExpenseTracker.
                  </Label>
                  <Button
                    variant="primary"
                    disabled={action.isPending}
                    onPress={() =>
                      run(async () => {
                        await bankSms.requestPermissions();
                        const result = await bankSms.getStatus();
                        setExplain(false);
                        if (!result.receivePermission || !result.readPermission)
                          setPaste(true);
                      })
                    }
                  >
                    CONTINUE TO ANDROID PERMISSIONS
                  </Button>
                </Card>
              )}
            </>
          )}
          <Heading>Import past bank SMS</Heading>
          {!data.readPermission ? (
            <Label muted>Allow SMS access above to import past alerts.</Label>
          ) : !connected && !action.isPending ? (
            <Label muted>Connect SMS capture first, then import.</Label>
          ) : (
            <Label muted>
              Duplicates are skipped, so importing again is safe.
            </Label>
          )}
          {data.readPermission && (
            <Row>
              {([1, 3, 6] as const).map((months) => (
                <Button
                  key={months}
                  disabled={!connected}
                  onPress={() =>
                    run(async () => {
                      const listener = bankSms.addListener(
                        "sms:progress",
                        (progress) =>
                          setFeedback(
                            "Scanned " +
                              progress.scanned +
                              " · found " +
                              progress.queued,
                          ),
                      );
                      try {
                        const queued = await bankSms.importPastSms(months);
                        setFeedback(
                          queued
                            ? `Found ${queued} bank alerts. They'll appear in Review and Activity shortly.`
                            : "No new bank alerts found in that period.",
                        );
                      } finally {
                        listener.remove();
                      }
                    })
                  }
                >
                  {months === 1 ? "1 MONTH" : `${months} MONTHS`}
                </Button>
              ))}
            </Row>
          )}
          <Heading>Add one manually</Heading>
          <Row>
            <Button onPress={() => setPaste(!paste)}>
              {paste ? "HIDE PASTE" : "PASTE AN SMS"}
            </Button>
            <Button
              variant="quiet"
              disabled={!connected}
              onPress={() =>
                run(async () => {
                  const accepted = await bankSms.pasteSms(
                    "HDFCBK",
                    "HDFC Bank: INR 1.00 debited from A/c XX1234 to ANDROID SMS TEST Ref " +
                      Date.now(),
                  );
                  setFeedback(
                    accepted
                      ? "Sent a ₹1.00 test. It will appear in Review or Activity; delete it after."
                      : "HDFCBK is not in your sender list.",
                  );
                })
              }
            >
              SEND A TEST
            </Button>
          </Row>
          {paste && (
            <Card>
              <Field
                accessibilityLabel="Bank sender ID"
                placeholder="Sender, for example HDFCBK"
                value={sender}
                onChangeText={setSender}
                maxLength={24}
                autoCapitalize="characters"
              />
              <Field
                accessibilityLabel="Bank SMS text"
                placeholder="Paste the bank SMS here"
                value={body}
                multiline
                onChangeText={setBody}
                maxLength={2000}
              />
              <Button
                variant="primary"
                disabled={!connected || !body.trim() || !sender.trim()}
                onPress={() =>
                  run(async () => {
                    const accepted =
                      isSenderAllowed(sender, data.senders) &&
                      (await bankSms.pasteSms(sender, body));
                    if (accepted) setBody("");
                    setFeedback(
                      accepted
                        ? "Added. It will appear in Review or Activity shortly."
                        : "That sender isn't a bank in your list, or it isn't a transaction alert.",
                    );
                  })
                }
              >
                ADD SMS
              </Button>
            </Card>
          )}
          {!!feedback && <Label>{feedback}</Label>}
          {action.isPending && <Label muted>Working…</Label>}
          {action.error && <Label error>{errorMessage(action.error)}</Label>}
          <Card>
            <Heading>Keep capture running</Heading>
            <Label muted>
              {data.batteryOptimized
                ? "Battery saving may stop capture while the app is closed."
                : "Battery saving is off for this app. Capture keeps running."}
            </Label>
            {data.batteryOptimized && (
              <>
                {brandStep ? (
                  <Label>On your phone: {brandStep}</Label>
                ) : (
                  <Label>
                    In battery settings, allow this app to run in the
                    background.
                  </Label>
                )}
                <Button
                  disabled={action.isPending}
                  onPress={() => run(() => bankSms.openBatterySettings())}
                >
                  OPEN BATTERY SETTINGS
                </Button>
              </>
            )}
          </Card>
          <Heading>Banks we listen to</Heading>
          <Label muted>
            {data.senders.length
              ? `${data.senders.length} bank and UPI sender IDs. Change them on the web.`
              : "No sender IDs configured."}
          </Label>
          {data.senders.length > 0 && (
            <Button
              variant="quiet"
              onPress={() => setShowSenders(!showSenders)}
            >
              {showSenders ? "HIDE LIST" : "SHOW LIST"}
            </Button>
          )}
          {showSenders && (
            <Label muted>
              {data.senders.map((item) => item.replace(/^\*-/, "")).join(", ")}
            </Label>
          )}
        </>
      )}
    </>
  );
}
