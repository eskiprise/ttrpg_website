import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { GameSystem } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";
import { verifyTelegramInitData } from "../../lib/telegramAuth.js";
import {
  getClubChatId,
  getClubChatThreadId,
  isClubChatMember,
  sendMessage,
  sendPoll,
} from "../../lib/telegramBot.js";

/**
 * Mirror of RATING_OPTIONS in ttrpg_poll_bot/lambda_handler.py — a poll created here
 * has to be answerable exactly like a `/rate` one, since the same poll_answer webhook
 * reads the chosen index (0 = "just looking", 1-10 = the rating).
 */
const RATING_OPTIONS = [
  "Подивитись відповідь",
  "1 / 10 🤬",
  "2 / 10 😡",
  "3 / 10 🥴",
  "4 / 10 😞",
  "5 / 10 🤔",
  "6 / 10 🙂",
  "7 / 10 😀",
  "8 / 10 ☺️",
  "9 / 10 🤩",
  "10 / 10 🌟🌟🌟",
];

/** Telegram caps a poll question at 300 characters, and "Оцінка (…)" wraps ours. */
const MAX_SESSION_NAME = 150;

export async function createTelegramPoll(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as {
    initData?: string;
    systemId?: string;
    sessionName?: string;
  };
  if (!body.initData) throw new HttpError(400, "initData is required");

  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  const sessionName = body.sessionName?.trim();
  if (!sessionName) throw new HttpError(400, "sessionName is required");
  if (sessionName.length > MAX_SESSION_NAME) {
    throw new HttpError(400, `sessionName must be at most ${MAX_SESSION_NAME} characters`);
  }
  if (!body.systemId) throw new HttpError(400, "systemId is required");

  // The system comes from the site's own list, so the poll title always starts with a
  // name the session counter recognises (see createSystemMatcher in shared).
  const system = (
    await ddb.send(
      new GetCommand({ TableName: Tables.gameSystems(), Key: { systemId: body.systemId } })
    )
  ).Item as GameSystem | undefined;
  if (!system) throw new HttpError(404, "Game system not found");

  const chatId = await getClubChatId();
  if (!(await isClubChatMember(chatId, user.id))) {
    throw new HttpError(403, "Only members of the club chat can create a poll");
  }

  const threadId = getClubChatThreadId();
  const questionText = `Оцінка (${system.name}: ${sessionName})`;
  const sent = await sendPoll({
    chat_id: chatId,
    question: questionText,
    options: RATING_OPTIONS,
    ...(threadId !== undefined && { message_thread_id: threadId }),
  });

  const pollId = sent.poll?.id;
  if (!pollId) throw new HttpError(502, "Telegram did not return a poll id");

  // Same row shape the bot writes, so this poll behaves like any other everywhere:
  // the game log, the stats, "My Games Conducted", and XP for whoever votes on it.
  await ddb.send(
    new PutCommand({
      TableName: Tables.telegramRatingPolls(),
      Item: {
        pollId,
        questionText,
        chatId,
        createdAt: new Date().toISOString(),
        creatorUserId: user.id,
        creatorFirstName: user.firstName,
        creatorLastName: user.lastName,
        creatorUsername: user.username,
        ...(threadId !== undefined && { messageThreadId: threadId }),
      },
    })
  );

  // The detailed-feedback button, exactly as `/rate` posts it. Best-effort: the poll
  // itself is already up, so a failure here must not read as "poll not created".
  const deepLink = process.env.MINI_APP_DEEP_LINK;
  if (deepLink) {
    try {
      await sendMessage({
        chat_id: chatId,
        text: "Залиште розгорнутий фідбек про цю сесію:",
        ...(threadId !== undefined && { message_thread_id: threadId }),
        reply_markup: {
          inline_keyboard: [[{ text: "📝 Залишити фідбек", url: `${deepLink}?startapp=feedback_${pollId}` }]],
        },
      });
    } catch (err) {
      console.error("Poll created but the feedback link failed to send", err);
    }
  }

  return json(201, { pollId, questionText });
}
