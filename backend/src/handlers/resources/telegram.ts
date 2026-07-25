import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { TelegramRecentRating, TelegramUserStats } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { verifyTelegramInitData } from "../../lib/telegramAuth.js";
import { HttpError, json } from "../../lib/response.js";

const RECENT_RATINGS_LIMIT = 10;

export async function getTelegramStats(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as { initData?: string };
  if (!body.initData) throw new HttpError(400, "initData is required");

  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  const result = await ddb.send(
    new QueryCommand({
      TableName: Tables.telegramRatingVotes(),
      IndexName: "telegramUserId-index",
      KeyConditionExpression: "telegramUserId = :userId",
      ExpressionAttributeValues: { ":userId": user.id },
    })
  );

  const votes = (result.Items ?? []) as {
    pollId: string;
    questionText: string;
    rating: number;
    answeredAt: string;
  }[];

  const totalRatingsGiven = votes.length;
  const averageRatingGiven = totalRatingsGiven
    ? votes.reduce((sum, v) => sum + v.rating, 0) / totalRatingsGiven
    : null;

  const recentRatings: TelegramRecentRating[] = votes
    .slice()
    .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
    .slice(0, RECENT_RATINGS_LIMIT)
    .map((v) => ({
      pollId: v.pollId,
      questionText: v.questionText,
      rating: v.rating,
      answeredAt: v.answeredAt,
    }));

  const displayName = user.lastName
    ? `${user.firstName} ${user.lastName}`
    : (user.username ? `${user.firstName} (@${user.username})` : user.firstName);

  const stats: TelegramUserStats = {
    telegramUserId: user.id,
    displayName,
    totalRatingsGiven,
    averageRatingGiven,
    recentRatings,
  };

  return json(200, { stats });
}
