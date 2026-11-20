/** "First aid, water rescue" → ["First aid", "water rescue"]. The API lower-cases and de-duplicates. */
export function parseSkills(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
