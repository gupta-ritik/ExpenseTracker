import { apiError, ok, withUser } from "../../../../../lib/api/http";
import { revokeIngestToken } from "../../../../../lib/capture/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withUser(
  async (user, _request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !(await revokeIngestToken(user.id, id)))
      return apiError("not_found", "Device could not be found.");
    return ok({ id, revoked: true });
  },
);
