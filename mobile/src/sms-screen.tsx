import { useState } from "react";
import { Linking } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { isSenderAllowed } from "@expense-tracker/shared/alerts";
import { errorMessage } from "./api";
import { bankSms, useSmsStatus } from "./bank-sms";
import { Button, Card, Field, Label, Row, State, Title } from "./ui";

export function SmsScreen({ reconnect }: { reconnect: () => void }) {
  const status = useSmsStatus();
  const [explain, setExplain] = useState(false);
  const [paste, setPaste] = useState(false);
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
  return (
    <>
      <Title>Bank SMS</Title>
      <State
        pending={status.isPending}
        error={status.error}
        retry={() => void status.refetch()}
      />
      {data && (
        <>
          <Card>
            <Label>
              LIVE CAPTURE · {data.receivePermission ? "ALLOWED" : "OFF"}
            </Label>
            <Label>
              INBOX IMPORT · {data.readPermission ? "ALLOWED" : "OFF"}
            </Label>
            <Label>QUEUED · {data.queueSize}</Label>
            <Label>
              LAST SENT ·{" "}
              {data.lastSent
                ? new Date(data.lastSent).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })
                : "NEVER"}
            </Label>
            {data.revoked && (
              <>
                <Label error>Device revoked: sign in again</Label>
                <Button onPress={reconnect}>SIGN IN AGAIN</Button>
              </>
            )}
            {!data.revoked && data.lastError && (
              <Label error>{data.lastError}</Label>
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
                  <Label>{"// BEFORE YOU ENABLE SMS"}</Label>
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
                    Settings to stop delivery. Clear queue deletes pending
                    alerts. You can delete imported transactions in
                    ExpenseTracker.
                  </Label>
                  <Button
                    selected
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
          <Label>{"// BANK SENDER IDS"}</Label>
          <Label>
            {data.senders.length
              ? data.senders.join(" · ")
              : "No sender IDs configured."}
          </Label>
          <Label>{"// IMPORT PAST BANK SMS"}</Label>
          {data.readPermission ? (
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
                              " · queued " +
                              progress.queued,
                          ),
                      );
                      try {
                        setFeedback(
                          "Queued " +
                            (await bankSms.importPastSms(months)) +
                            " masked alerts.",
                        );
                      } finally {
                        listener.remove();
                      }
                    })
                  }
                >
                  {months} {months === 1 ? "MONTH" : "MONTHS"}
                </Button>
              ))}
            </Row>
          ) : (
            <Label>Allow inbox access to import past alerts.</Label>
          )}
          <Row>
            <Button onPress={() => setPaste(!paste)}>PASTE SMS</Button>
            <Button
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
                      ? "Queued a synthetic ₹1.00 test transaction."
                      : "HDFCBK is not enabled in your sender list.",
                  );
                })
              }
            >
              SEND TEST
            </Button>
            <Button
              disabled={!connected || !data.queueSize}
              onPress={() => run(() => bankSms.retryNow())}
            >
              RETRY QUEUE
            </Button>
            <Button
              disabled={action.isPending || !data.queueSize}
              onPress={() => run(() => bankSms.clearQueue())}
            >
              CLEAR QUEUE
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
                placeholder="Paste bank SMS"
                value={body}
                multiline
                onChangeText={setBody}
                maxLength={2000}
              />
              <Button
                selected
                disabled={!connected || !body.trim() || !sender.trim()}
                onPress={() =>
                  run(async () => {
                    const accepted =
                      isSenderAllowed(sender, data.senders) &&
                      (await bankSms.pasteSms(sender, body));
                    if (accepted) setBody("");
                    setFeedback(
                      accepted
                        ? "Masked alert queued."
                        : "This sender or message does not qualify.",
                    );
                  })
                }
              >
                MASK AND QUEUE
              </Button>
            </Card>
          )}
          <Card>
            <Label>
              {"// BATTERY · "}
              {data.batteryOptimized ? "OPTIMIZATION ON" : "UNRESTRICTED"}
            </Label>
            <Button
              disabled={action.isPending}
              onPress={() => run(() => bankSms.openBatterySettings())}
            >
              OPEN BATTERY SETTINGS
            </Button>
            <Label>Xiaomi · App battery saver → No restrictions</Label>
            <Label>
              Oppo / Realme · Battery usage → Allow background activity and auto
              launch
            </Label>
            <Label>
              Vivo · Battery → Background power consumption management → Allow
            </Label>
            <Label>
              Samsung · Background usage limits → Never auto sleeping apps
            </Label>
          </Card>
        </>
      )}
      {!!feedback && <Label>{feedback}</Label>}
      {action.isPending && <Label>Working…</Label>}
      {action.error && <Label error>{errorMessage(action.error)}</Label>}
    </>
  );
}
