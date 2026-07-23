import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { requireAdmin } from "../../lib/auth.js";
import { getSettings, setAnonymizeToggle } from "../../lib/settings.js";
import { HttpError, json } from "../../lib/response.js";

export async function updateAnonymizeToggle(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const body = JSON.parse(event.body ?? "{}") as { anonymizeLoggedOutView?: boolean };
  if (typeof body.anonymizeLoggedOutView !== "boolean") {
    throw new HttpError(400, "anonymizeLoggedOutView (boolean) is required");
  }
  await setAnonymizeToggle(body.anonymizeLoggedOutView);
  return json(200, { anonymizeLoggedOutView: body.anonymizeLoggedOutView });
}

export async function getPublicSettings() {
  const settings = await getSettings();
  return json(200, { settings });
}
