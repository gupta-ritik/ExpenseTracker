import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Linking } from "react-native";
import { api, errorMessage, type Device } from "./api";
import { apiBaseUrl } from "./auth";
import { bankSms, useSmsStatus } from "./bank-sms";
import { Button, Card, Label, State, Title } from "./ui";

export function Settings({
  email,
  signOut,
}: {
  email: string;
  signOut: () => void;
}) {
  const query = useQuery({
    queryKey: ["devices"],
    queryFn: () => api<{ items: Device[] }>("/devices"),
  });
  const sms = useSmsStatus();
  const client = useQueryClient();
  const action = useMutation({
    mutationFn: async (id: string) => {
      await api("/devices/" + id, "DELETE");
      await bankSms.revokeDevice(id);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["devices"] });
      void sms.refetch();
    },
  });
  const link = useMutation({ mutationFn: () => Linking.openURL(apiBaseUrl) });
  const devices =
    query.data?.items.filter((device) => device.kind === "device") ?? [];
  return (
    <>
      <Title>Settings</Title>
      <Card>
        <Label>{"// ACCOUNT"}</Label>
        <Label>{email}</Label>
        <Button onPress={signOut}>SIGN OUT</Button>
      </Card>
      <Label>{"// DEVICES"}</Label>
      <State
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.isSuccess && !devices.length && (
        <Label>No devices registered.</Label>
      )}
      {devices.map((device) => (
        <Card key={device.id}>
          <Label>
            {device.name}
            {device.id === sms.data?.deviceId ? " · THIS DEVICE" : ""}
          </Label>
          {device.revokedAt ? (
            <Label>REVOKED</Label>
          ) : (
            <Button
              disabled={action.isPending}
              onPress={() => action.mutate(device.id)}
            >
              REVOKE
            </Button>
          )}
        </Card>
      ))}
      {action.error && <Label error>{errorMessage(action.error)}</Label>}
      <Button onPress={() => link.mutate()}>OPEN FULL APP ON WEB</Button>
      {link.error && <Label error>{errorMessage(link.error)}</Label>}
    </>
  );
}
