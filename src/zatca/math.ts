import Decimal from "decimal.js";

export class ZatcaMath {
  static truncate(value: Decimal.Value, decimals = 2): string {
    return new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_DOWN).toFixed(decimals);
  }

  static truncateNumber(value: Decimal.Value, decimals = 2): number {
    return Number(ZatcaMath.truncate(value, decimals));
  }

  static monetary(value: Decimal.Value): string {
    return ZatcaMath.truncate(value, 2);
  }

  static monetaryNumber(value: Decimal.Value): number {
    return ZatcaMath.truncateNumber(value, 2);
  }

  static precise(value: Decimal.Value, decimals = 14): string {
    return ZatcaMath.truncate(value, decimals);
  }

  static calculateVATAmount(taxableAmount: Decimal.Value, vatRatePercent: Decimal.Value): number {
    return ZatcaMath.monetaryNumber(
      new Decimal(taxableAmount).mul(new Decimal(vatRatePercent).div(100))
    );
  }

  /**
   * Sum already-truncated 2dp amounts with Decimal.plus (never JavaScript +).
   * `new Decimal(17.4 + 2.61)` is 20.0099… and ROUND_DOWN becomes 20.00,
   * which fails BR-KSA-51 / BR-CO-10 / BR-S-08. Adding the operands separately
   * keeps 20.01 and 26.10.
   */
  static addMonetary(...values: Decimal.Value[]): string {
    const sum = values.reduce<Decimal>(
      (acc, value) => acc.plus(new Decimal(value)),
      new Decimal(0)
    );
    return sum.toFixed(2);
  }

  static calculateLineTotalWithVAT(lineNetAmount: Decimal.Value, lineVATAmount: Decimal.Value): number {
    return Number(ZatcaMath.addMonetary(lineNetAmount, lineVATAmount));
  }
}

export const truncate = ZatcaMath.truncate;
export const truncateNumber = ZatcaMath.truncateNumber;
export const formatMonetaryAmount = ZatcaMath.monetary;
export const addMonetary = ZatcaMath.addMonetary;
export const calculateVATAmount = ZatcaMath.calculateVATAmount;
export const calculateLineTotalWithVAT = ZatcaMath.calculateLineTotalWithVAT;
