/**
 * Checks whether an environment variable or setting holds a real value:
 * not empty, and not a placeholder such as "todo" or "placeholder-later".
 * Kept free of imports so auth modules can use it without loading the database client.
 */
export function isConfigured(value?: string | null): value is string {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed !== "" && !trimmed.startsWith("todo") && !trimmed.startsWith("placeholder");
}
