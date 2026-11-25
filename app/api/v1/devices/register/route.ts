import { invalid, ok, readJson, withUser } from "../../../../../lib/api/http";
import { deviceRegistration } from "../../../../../lib/api/schemas";
import { createIngestToken } from "../../../../../lib/capture/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a device ingest token. The token is returned once and only its hash is stored. */
export const POST = withUser(async (user, request) => {
  const input = deviceRegistration.safeParse(await readJson(request));
  if (!input.success) return invalid(input.error);
  const { name, ...deviceInfo } = input.data;
  const created = await createIngestToken(user.id, name, "device", deviceInfo);
  return ok(
    {
      id: created.id,
      name: created.name,
      token: created.token,
      createdAt: created.createdAt,
    },
    201,
  );
});
