import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SiteSettings } from "@ttrpg-club/shared";
import { ddb, Tables } from "./dynamo.js";
import { optionalAuth } from "./auth.js";

const SETTINGS_PK = "SETTINGS";

export async function getSettings(): Promise<SiteSettings> {
  const result = await ddb.send(
    new GetCommand({ TableName: Tables.settings(), Key: { pk: SETTINGS_PK } })
  );
  return {
    anonymizeLoggedOutView: result.Item?.anonymizeLoggedOutView ?? true,
  };
}

export async function setAnonymizeToggle(value: boolean): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: Tables.settings(),
      Item: { pk: SETTINGS_PK, anonymizeLoggedOutView: value },
    })
  );
}

/** Should a caller of a public endpoint see anonymized names? True only when the site-wide toggle is on AND the caller isn't logged in. */
export async function shouldAnonymizeFor(event: APIGatewayProxyEventV2): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.anonymizeLoggedOutView) return false;
  return (await optionalAuth(event)) === null;
}
