// Verwalterhonorar-Berechnung (monatlich).

export type FeeType = "PAUSCHAL" | "PRO_EINHEIT" | "PROZENT";

export interface FeeConfig {
  feeType: FeeType;
  feeValue: number;
}

export interface FeeBase {
  unitCount: number;
  monthlyRentSum: number; // Summe monatliche Sollmiete (warm)
}

/** Monatliches Verwalterhonorar, auf Cent gerundet. */
export function computeMgmtFee(cfg: FeeConfig, base: FeeBase): number {
  let fee = 0;
  switch (cfg.feeType) {
    case "PAUSCHAL":
      fee = cfg.feeValue;
      break;
    case "PRO_EINHEIT":
      fee = cfg.feeValue * base.unitCount;
      break;
    case "PROZENT":
      fee = (base.monthlyRentSum * cfg.feeValue) / 100;
      break;
  }
  return Math.round(fee * 100) / 100;
}
