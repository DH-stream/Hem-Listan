export function formatIngredientName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const firstWord = trimmed.match(/^\S+/)?.[0] ?? "";
  if (firstWord !== firstWord.toLocaleLowerCase("sv")) return trimmed;

  const [firstCharacter, ...rest] = Array.from(trimmed);
  return `${firstCharacter.toLocaleUpperCase("sv")}${rest.join("")}`;
}
