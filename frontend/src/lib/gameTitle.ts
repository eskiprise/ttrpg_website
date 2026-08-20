/**
 * /rate polls are created with a questionText like "Оцінка (Session name)" (see
 * handle_poll_command in ttrpg_poll_bot) — that wrapping makes sense as the actual
 * Telegram poll's question, but reads redundantly as a page/list title here, so strip
 * it for display. Falls back to the raw text for anything that doesn't match (e.g. a
 * poll created before this convention, if any).
 */
export function formatGameTitle(questionText: string): string {
  const match = questionText.match(/^Оцінка\s*\((.+)\)$/);
  return match ? match[1] : questionText;
}
