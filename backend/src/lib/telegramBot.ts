import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { getBotToken } from "./telegramAuth.js";
import { HttpError } from "./response.js";

/**
 * The little slice of the Telegram Bot API this backend needs to post a poll into the
 * club chat on a member's behalf — the same calls ttrpg_poll_bot's `/rate` makes, from
 * the Mini App instead of a chat command.
 */

const ssm = new SSMClient({});
let cachedChatId: number | undefined;

/** The club's group chat, stored in SSM by Terraform and shared with the poll bot. */
export async function getClubChatId(): Promise<number> {
  if (cachedChatId !== undefined) return cachedChatId;
  const paramName = process.env.TELEGRAM_CLUB_CHAT_ID_PARAM;
  if (!paramName) throw new Error("Missing TELEGRAM_CLUB_CHAT_ID_PARAM env var");

  let result;
  try {
    // SecureString, like the bot token — without WithDecryption the API happily returns
    // the ciphertext instead of the chat id.
    result = await ssm.send(new GetParameterCommand({ Name: paramName, WithDecryption: true }));
  } catch (err) {
    // Almost always the Lambda's IAM policy not (yet) allowing this parameter.
    console.error(`Could not read ${paramName}`, err);
    throw new HttpError(502, `Could not read the club chat id from ${paramName}`);
  }
  const value = result.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${paramName} has no value`);
  cachedChatId = Number(value);
  if (!Number.isFinite(cachedChatId)) throw new Error(`SSM parameter ${paramName} is not a chat id`);
  return cachedChatId;
}

/**
 * The forum topic polls live in ("Ігри"), so a Mini App poll lands in the same place a
 * `/rate` poll would. Unset means the chat has no topics and posts go to the main feed.
 */
export function getClubChatThreadId(): number | undefined {
  const raw = process.env.TELEGRAM_CLUB_CHAT_THREAD_ID;
  if (!raw) return undefined;
  const threadId = Number(raw);
  return Number.isFinite(threadId) ? threadId : undefined;
}

async function callTelegram<T>(method: string, payload: object): Promise<T> {
  const token = await getBotToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) {
    // Surfaced rather than swallowed into a generic 500: what Telegram refuses is
    // nearly always a configuration fact someone can act on ("chat not found",
    // "message thread not found", "not enough rights to send polls").
    console.error(`Telegram ${method} failed`, { payload, description: data.description });
    throw new HttpError(502, `Telegram: ${data.description ?? `${method} failed (${response.status})`}`);
  }
  return data.result as T;
}

/** Statuses that mean "this person is in the chat right now". */
const MEMBER_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

/**
 * Whether a user belongs to the club chat. This is what gates poll creation: the Mini
 * App can be opened by anyone who finds the bot, but only the club's own members get to
 * post into its chat. A restricted member counts — they're still in the group, and
 * Telegram will reject the send itself if they've actually lost the right to post.
 */
export async function isClubChatMember(chatId: number, userId: number): Promise<boolean> {
  try {
    const member = await callTelegram<{ status: string }>("getChatMember", {
      chat_id: chatId,
      user_id: userId,
    });
    return MEMBER_STATUSES.has(member.status);
  } catch (err) {
    // Someone who was never in the chat comes back as an error rather than a status —
    // that's a plain "no". Anything else (chat not found, bot not in the chat) is a
    // configuration problem and must not masquerade as "you're not a member".
    if (err instanceof HttpError && /user not found/i.test(err.message)) return false;
    throw err;
  }
}

export interface SentPoll {
  poll: { id: string; question: string };
}

export async function sendPoll(payload: {
  chat_id: number;
  question: string;
  options: string[];
  message_thread_id?: number;
}): Promise<SentPoll> {
  return callTelegram<SentPoll>("sendPoll", {
    is_anonymous: false,
    allows_multiple_answers: false,
    ...payload,
  });
}

export async function sendMessage(payload: {
  chat_id: number;
  text: string;
  message_thread_id?: number;
  reply_markup?: object;
}): Promise<void> {
  await callTelegram("sendMessage", payload);
}
