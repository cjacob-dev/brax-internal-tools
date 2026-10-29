const MASK = "\u2022";

/**
 * Masks a PII value for display, showing the last 4 characters only.
 * Values of 4 characters or fewer are fully masked. Never render raw PII.
 */
export function maskPII(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const v = String(value);
  if (v.length === 0) return "";
  if (v.length <= 4) return MASK.repeat(v.length);
  return MASK.repeat(v.length - 4) + v.slice(-4);
}

/** Field names treated as PII when they appear in audit before/after payloads. */
export const PII_FIELDS = new Set([
  "ssn",
  "taxId",
  "tin",
  "accountNumber",
  "routingNumber",
  "cardNumber",
  "dateOfBirth",
  "dob",
  "phone",
  "phoneNumber",
  "personalEmail",
  "legalName",
  "fullName",
  "address",
  "streetAddress",
]);

/** Deep-copies a JSON-like value, masking any PII_FIELDS keys. */
export function redactPIIFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPIIFields);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        PII_FIELDS.has(key) && (typeof inner === "string" || typeof inner === "number") ? maskPII(inner) : redactPIIFields(inner),
      ]),
    );
  }
  return value;
}
