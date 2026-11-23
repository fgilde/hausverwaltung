export const CURRENCIES = ["EUR", "CZK"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency === value);
}

export function supportsEuroExports(currency: Currency): boolean {
  return currency === "EUR";
}

export function matchesLedgerCurrency(source: string | undefined, currency: Currency): boolean {
  // Older EUR imports may omit the code. A CZK ledger requires an explicit match.
  return source ? source === currency : currency === "EUR";
}
