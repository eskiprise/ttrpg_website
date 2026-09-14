/** Truncates to maxLength and appends an ellipsis — unlike a bare .slice(), never cuts
 * text off with no visual sign that more of it exists. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
