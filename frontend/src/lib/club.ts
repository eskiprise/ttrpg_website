/**
 * Where "Хочу зіграти" / "Написати в Telegram" sends someone. Every join CTA on the site
 * points here, so it's one constant rather than a link repeated per page.
 *
 * A person, not the bot: the bot can't hold a conversation, and a newcomer asking
 * "can I come on Thursday?" needs someone to actually answer.
 */
export const CLUB_TELEGRAM_URL = "https://t.me/Guchara";

/** The club's Google Maps listing — where "Відкрити в Google Maps" sends someone. */
export const CLUB_MAPS_URL = "https://maps.app.goo.gl/JSUTWUYu536BGBceA";

/**
 * Keyless Google Maps embed of the club's own listing. `cid` is the listing's id (the
 * decimal form of the second half of the 0x…:0x… feature id in its Maps URL), so the pin
 * shows the club's name and card — a bare lat/lng query draws no marker. The official
 * /maps/embed/v1 endpoint would need an API key; this legacy output=embed form doesn't.
 */
export const CLUB_MAP_EMBED_URL = "https://maps.google.com/maps?cid=8897128142183007864&z=17&hl=uk&output=embed";
