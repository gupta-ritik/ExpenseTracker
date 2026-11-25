import { requireNativeModule } from "expo";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { apiBaseUrl } from "./auth";

export type SmsStatus = {
  receivePermission: boolean;
  readPermission: boolean;
  batteryOptimized: boolean;
  queueSize: number;
  lastSent: number | null;
  revoked: boolean;
  deviceId: string | null;
  ownerId: string | null;
  senders: string[];
  lastError: string | null;
};
type Subscription = { remove: () => void };
type NativeSms = {
  getStatus(): Promise<SmsStatus>;
  requestPermissions(): Promise<unknown>;
  importPastSms(months: number): Promise<number>;
  getQueue(): Promise<{ queued: number }>;
  retryNow(): Promise<void>;
  setSenderList(senders: string[]): Promise<void>;
  clearQueue(): Promise<void>;
  configure(
    ownerId: string,
    deviceId: string,
    token: string,
    baseUrl: string,
  ): Promise<void>;
  disconnect(): Promise<void>;
  revokeDevice(id: string): Promise<void>;
  pasteSms(sender: string, body: string): Promise<boolean>;
  openBatterySettings(): Promise<void>;
  addListener(
    event: "sms:queued" | "sms:sent" | "sms:failed" | "sms:progress",
    callback: (event: { scanned: number; queued: number }) => void,
  ): Subscription;
};

export const bankSms = requireNativeModule<NativeSms>("BankSms");

let registration: Promise<void> | undefined;
export function registerDevice(owner: string) {
  registration ??= (async () => {
    const state = await bankSms.getStatus();
    if (state.ownerId && state.ownerId !== owner) await bankSms.disconnect();
    const { items } = await api<{ items: string[] }>("/sms/senders");
    await bankSms.setSenderList(items);
    if (state.ownerId === owner && state.deviceId && !state.revoked) return;
    const device = await api<{ id: string; token: string }>(
      "/devices/register",
      "POST",
      {},
    );
    try {
      await bankSms.configure(owner, device.id, device.token, apiBaseUrl);
    } catch (error) {
      await api("/devices/" + device.id, "DELETE").catch(() => undefined);
      throw error;
    }
  })().finally(() => {
    registration = undefined;
  });
  return registration;
}

export async function disconnectBankSms() {
  await registration?.catch(() => undefined);
  await bankSms.disconnect();
}

export function useSmsStatus() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["sms-status"],
    queryFn: () => bankSms.getStatus(),
    refetchInterval: 3000,
  });
  useEffect(() => {
    const subscriptions = (
      ["sms:queued", "sms:sent", "sms:failed"] as const
    ).map((event) =>
      bankSms.addListener(event, () => {
        void client.invalidateQueries({ queryKey: ["sms-status"] });
        if (event === "sms:sent") {
          void client.invalidateQueries({ queryKey: ["dashboard"] });
          void client.invalidateQueries({ queryKey: ["transactions"] });
          void client.invalidateQueries({ queryKey: ["review"] });
        }
      }),
    );
    return () => subscriptions.forEach((item) => item.remove());
  }, [client]);
  return query;
}
