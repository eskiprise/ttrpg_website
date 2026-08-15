import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ulid } from "ulid";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type {
  TelegramFeedbackEligibility,
  TelegramFeedbackEligibilityRequest,
  TelegramFeedbackSubmission,
  TelegramRecentRating,
  TelegramUserStats,
} from "@ttrpg-club/shared";
import { POLL_RATING_MAX, POLL_RATING_MIN } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { formatTelegramDisplayName, verifyTelegramInitData } from "../../lib/telegramAuth.js";
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

  const stats: TelegramUserStats = {
    telegramUserId: user.id,
    displayName: formatTelegramDisplayName(user),
    totalRatingsGiven,
    averageRatingGiven,
    recentRatings,
  };

  return json(200, { stats });
}

function isValidRating(value: unknown): value is number {
  return typeof value === "number" && value >= POLL_RATING_MIN && value <= POLL_RATING_MAX;
}

/** Has this user cast a rating vote on this poll? Required before they can leave extended feedback. */
async function hasVotedOnPoll(pollId: string, telegramUserId: number): Promise<boolean> {
  const result = await ddb.send(
    new GetCommand({
      TableName: Tables.telegramRatingVotes(),
      Key: { pollId, telegramUserId },
    })
  );
  return Boolean(result.Item);
}

/**
 * Lets the Mini App check eligibility before rendering the feedback form, so someone who
 * hasn't voted sees an explanatory message instead of a form they'll be rejected from on
 * submit.
 */
export async function getTelegramFeedbackEligibility(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as Partial<TelegramFeedbackEligibilityRequest>;
  if (!body.initData) throw new HttpError(400, "initData is required");
  if (!body.pollId) throw new HttpError(400, "pollId is required");

  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  const eligibility: TelegramFeedbackEligibility = {
    eligible: await hasVotedOnPoll(body.pollId, user.id),
  };
  return json(200, { eligibility });
}

/**
 * Detailed, mostly-anonymous feedback (four 1-10 ratings + optional free text) left via
 * the Mini App's feedback form — a separate, private channel from the quick /rate poll
 * vote. Stored here purely for the record; the actual delivery to the GM happens via a
 * DynamoDB Stream on this table triggering a notifier Lambda in ttrpg_poll_bot (which
 * DMs the GM, revealing the submitter's identity only if they opted in).
 */
export async function postTelegramFeedback(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as Partial<TelegramFeedbackSubmission>;
  if (!body.initData) throw new HttpError(400, "initData is required");
  if (!body.pollId) throw new HttpError(400, "pollId is required");
  if (
    !isValidRating(body.adventureRating) ||
    !isValidRating(body.tableRating) ||
    !isValidRating(body.gmRating) ||
    !isValidRating(body.selfRating)
  ) {
    throw new HttpError(400, `Ratings must be between ${POLL_RATING_MIN} and ${POLL_RATING_MAX}`);
  }

  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  if (!(await hasVotedOnPoll(body.pollId, user.id))) {
    throw new HttpError(403, "You must vote on this session before leaving extended feedback");
  }

  await ddb.send(
    new PutCommand({
      TableName: Tables.telegramFeedback(),
      Item: {
        pollId: body.pollId,
        feedbackId: ulid(),
        telegramUserId: user.id,
        submitterFirstName: user.firstName,
        submitterLastName: user.lastName ?? "",
        submitterUsername: user.username ?? "",
        revealIdentity: Boolean(body.revealIdentity),
        adventureRating: body.adventureRating,
        tableRating: body.tableRating,
        gmRating: body.gmRating,
        selfRating: body.selfRating,
        feedbackText: body.feedbackText?.trim() ?? "",
        submittedAt: new Date().toISOString(),
      },
    })
  );

  return json(201, { ok: true });
}
