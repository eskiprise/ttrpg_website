import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const Tables = {
  users: () => requireEnv("TABLE_USERS"),
  signupRequests: () => requireEnv("TABLE_SIGNUP_REQUESTS"),
  gameSystems: () => requireEnv("TABLE_GAME_SYSTEMS"),
  games: () => requireEnv("TABLE_GAMES"),
  gameParticipants: () => requireEnv("TABLE_GAME_PARTICIPANTS"),
  gamePollVotes: () => requireEnv("TABLE_GAME_POLL_VOTES"),
  gameComments: () => requireEnv("TABLE_GAME_COMMENTS"),
  settings: () => requireEnv("TABLE_SETTINGS"),
};
