export const PREPAYMENT_COMPONENT_TYPES = ["NEBENKOSTEN", "HEIZKOSTEN"] as const;
export type PrepaymentComponentType = (typeof PREPAYMENT_COMPONENT_TYPES)[number];

export type RentComponentLike = {
  type: string;
  amount: unknown;
  effectiveDate: Date | null;
};

/**
 * Returns the amount of the latest component of `type` that is effective at
 * the beginning of `at`. A missing effective date is treated as the lease's
 * original component (i.e. effective before all dated changes).
 */
export function componentAmountAt(
  components: RentComponentLike[],
  type: string,
  at: Date,
): number {
  let selected: RentComponentLike | undefined;
  for (const component of components) {
    if (component.type !== type) continue;
    if (component.effectiveDate && component.effectiveDate > at) continue;
    if (!selected) {
      selected = component;
      continue;
    }
    const selectedDate = selected.effectiveDate?.getTime() ?? Number.NEGATIVE_INFINITY;
    const componentDate = component.effectiveDate?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (componentDate >= selectedDate) selected = component;
  }
  return selected ? Number(selected.amount) : 0;
}

/**
 * Current recurring rent components. For service-charge/heating prepayments
 * only the latest value per type is active; other component types may occur
 * more than once (e.g. two parking spaces) and therefore remain additive.
 */
export function recurringComponentAmountAt(components: RentComponentLike[], at: Date): number {
  const prepayments = PREPAYMENT_COMPONENT_TYPES.reduce(
    (sum, type) => sum + componentAmountAt(components, type, at),
    0,
  );
  const other = components
    .filter((component) => !PREPAYMENT_COMPONENT_TYPES.includes(component.type as PrepaymentComponentType))
    .filter((component) => !component.effectiveDate || component.effectiveDate <= at)
    .reduce((sum, component) => sum + Number(component.amount), 0);
  return prepayments + other;
}

export function monthlyPrepaymentAt(components: RentComponentLike[], at: Date): number {
  return PREPAYMENT_COMPONENT_TYPES.reduce(
    (sum, type) => sum + componentAmountAt(components, type, at),
    0,
  );
}

/**
 * Calculates service-charge prepayments month by month. The existing
 * allocation engine deliberately works with calendar months, so an effective
 * date changes the amount starting with its calendar month.
 */
export function prepaymentForLeaseYear(
  components: RentComponentLike[],
  leaseStart: Date,
  leaseEnd: Date | null,
  year: number,
): number {
  let total = 0;
  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
    if (leaseStart > monthEnd || (leaseEnd && leaseEnd < monthStart)) continue;
    total += monthlyPrepaymentAt(components, monthStart);
  }
  return Math.round(total * 100) / 100;
}
