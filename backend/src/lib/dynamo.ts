import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * A DynamoDB Scan returns at most 1MB per call, so a single ScanCommand silently
 * truncates once a table outgrows that — which would quietly under-count whatever's
 * reading it rather than fail. Page through until LastEvaluatedKey is exhausted.
 */
export async function scanAll<T>(tableName: string): Promise<T[]> {
  const items: T[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey })
    );
    items.push(...((result.Items ?? []) as T[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const Tables = {
  users: () => requireEnv("TABLE_USERS"),
  signupRequests: () => requireEnv("TABLE_SIGNUP_REQUESTS"),
  gameSystems: () => requireEnv("TABLE_GAME_SYSTEMS"),
  gameComments: () => requireEnv("TABLE_GAME_COMMENTS"),
  settings: () => requireEnv("TABLE_SETTINGS"),
  telegramRatingVotes: () => requireEnv("TABLE_TELEGRAM_RATING_VOTES"),
  telegramRatingPolls: () => requireEnv("TABLE_TELEGRAM_RATING_POLLS"),
  telegramFeedback: () => requireEnv("TABLE_TELEGRAM_FEEDBACK"),
  telegramXpLedger: () => requireEnv("TABLE_TELEGRAM_XP_LEDGER"),
  telegramPlayerLevel: () => requireEnv("TABLE_TELEGRAM_PLAYER_LEVEL"),
  telegramAchievements: () => requireEnv("TABLE_TELEGRAM_ACHIEVEMENTS"),
};
