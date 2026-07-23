import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SiteSettings } from "@ttrpg-club/shared";
import { ddb, Tables } from "./dynamo.js";

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
