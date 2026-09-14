/**
 * Where "Хочу зіграти" / "Написати в Telegram" sends someone. Every join CTA on the site
 * points here, so it's one constant rather than a link repeated per page.
 *
 * A person, not the bot: the bot can't hold a conversation, and a newcomer asking
 * "can I come on Thursday?" needs someone to actually answer.
 */
export const CLUB_TELEGRAM_URL = "https://t.me/Guchara";
