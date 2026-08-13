import {
  ZATCAInvoiceLineItem,
  ZATCAInvoiceProps,
} from "./simplified_tax_invoice";
import { XMLDocument } from "../parser";
import Decimal from "decimal.js";
import { ZATCA_CONSTANTS } from "./constants";
import { ZatcaMath } from "./math";

interface CACTaxableAmount {
  tax_amount: Decimal;
  taxable_amount: Decimal;
  exist: boolean;
}

const roundingNumber = (_acceptWarning: boolean, number: Decimal.Value): string => {
  try {
    return ZatcaMath.monetary(number);
  } catch (e) {
    throw e;
  }
};

const lineDiscountTotal = (line_item: ZATCAInvoiceLineItem): number => {
  const total =
    line_item.discounts?.reduce((previous, discount) => previous + discount.amount, 0) || 0;
  return ZatcaMath.truncateNumber(total, 14);
};

/**
 * Truncate net and VAT to 2dp, then add those strings with Decimal.plus.
 * Never add the 2dp amounts with JavaScript `+` (BR-KSA-51 / BR-CO-10 / BR-S-08).
 */
const computeLineAmounts = (line_item: ZATCAInvoiceLineItem) => {
  const line_discounts = lineDiscountTotal(line_item);
  const line_extension_amount = ZatcaMath.monetary(
    new Decimal(line_item.quantity).times(
      new Decimal(line_item.tax_exclusive_price).minus(line_discounts)
    )
  );
  const line_item_total_taxes = ZatcaMath.monetary(
    new Decimal(line_extension_amount).times(line_item.VAT_percent)
  );
  const rounding_amount = ZatcaMath.addMonetary(
    line_extension_amount,
    line_item_total_taxes
  );

  return {
    line_discounts,
    line_extension_amount,
    line_item_total_taxes,
    rounding_amount,
  };
};

const constructLineItemTotals = (
  line_item: ZATCAInvoiceLineItem,
  _acceptWarning: boolean
) => {
  let cacAllowanceCharges: any[] = [];
  let cacClassifiedTaxCategories: any[] = [];
  let cacTaxTotal = {};

  const VAT = {
    "cbc:ID": line_item.VAT_percent ? ZATCA_CONSTANTS.VAT_CATEGORY_STANDARD : line_item.vat_category?.code,

    "cbc:Percent": line_item.VAT_percent
      ? (line_item.VAT_percent * 100).toString()
      : 0.0,
    "cac:TaxScheme": {
      "cbc:ID": "VAT",
    },
  };
  cacClassifiedTaxCategories.push(VAT);

  line_item.discounts?.map((discount) => {
    cacAllowanceCharges.push({
      "cbc:ChargeIndicator": "false",
      "cbc:AllowanceChargeReason": discount.reason,
      "cbc:Amount": {
        "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
        "#text": ZatcaMath.precise(discount.amount, 14),
      },
      "cbc:BaseAmount": {
        "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
        "#text": line_item.tax_exclusive_price,
      },

    });
  });

  const {
    line_discounts,
    line_extension_amount,
    line_item_total_taxes,
    rounding_amount,
  } = computeLineAmounts(line_item);

  cacTaxTotal = {
    "cbc:TaxAmount": {
      "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
      "#text": line_item_total_taxes,
    },
    "cbc:RoundingAmount": {
      "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
      "#text": rounding_amount,
    },

  };

  return {
    cacAllowanceCharges,
    cacClassifiedTaxCategories,
    cacTaxTotal,
    line_item_total_taxes,
    line_discounts,
    line_extension_amount,
  };
};

const constructLineItem = (
  line_item: ZATCAInvoiceLineItem,
  acceptWarning: boolean
) => {
  const {
    cacAllowanceCharges,
    cacClassifiedTaxCategories,
    cacTaxTotal,
    line_item_total_taxes,
    line_discounts,
    line_extension_amount,
  } = constructLineItemTotals(line_item, acceptWarning);

  return {
    line_item_xml: {
      "cbc:ID": line_item.id,
      "cbc:InvoicedQuantity": {
        "@_unitCode": "PCE",
        "#text": line_item.quantity,
      },
      "cbc:LineExtensionAmount": {
        "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
        "#text": line_extension_amount,
      },

      "cac:TaxTotal": cacTaxTotal,
      "cac:Item": {
        "cbc:Name": line_item.name,
        "cac:ClassifiedTaxCategory": cacClassifiedTaxCategories,
      },
      "cac:Price": {
        "cbc:PriceAmount": {
          "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
          "#text": ZatcaMath.precise(
            new Decimal(line_item.tax_exclusive_price).minus(new Decimal(line_discounts)),
            14
          ),
        },

        "cac:AllowanceCharge": cacAllowanceCharges,
      },
    },
    line_item_totals: {
      taxes_total: line_item_total_taxes,
      discounts_total: line_discounts,
      extension_amount: line_extension_amount,
    },
  };
};

const constructTaxTotal = (
  line_items: ZATCAInvoiceLineItem[],
  acceptWarning: boolean
) => {
  const cacTaxSubtotal: any[] = [];
  const zeroTaxSubtotal: any[] = [];

  const without_tax_items = line_items.filter((item) => item.VAT_percent == 0);
  const modifiedZeroTaxSubTotal = (items: ZATCAInvoiceLineItem[]) => {
    let zeroTaxObj: {
      [key: string]: {
        total_taxable_amount: Decimal;
        total_tax_amount: Decimal;
        reason: string;
        reason_code: string;
      };
    } = {};

    items.forEach((item) => {
      if (item.VAT_percent != 0) return;
      const { line_extension_amount, line_item_total_taxes } = computeLineAmounts(item);

      let code = item.vat_category.code;
      if (code && zeroTaxObj.hasOwnProperty(code)) {
        zeroTaxObj[code].total_tax_amount = zeroTaxObj[code].total_tax_amount.plus(
          line_item_total_taxes
        );
        zeroTaxObj[code].total_taxable_amount = zeroTaxObj[code].total_taxable_amount.plus(
          line_extension_amount
        );
      } else if (code && !zeroTaxObj.hasOwnProperty(code)) {
        zeroTaxObj[code] = {
          total_tax_amount: new Decimal(line_item_total_taxes),
          total_taxable_amount: new Decimal(line_extension_amount),
          reason: item.vat_category?.reason || "",
          reason_code: item.vat_category?.reason_code || "",
        };
      } else {
        throw new Error("Zero Tax percent must has vat category code");
      }
    });
    return zeroTaxObj;
  };

  if (without_tax_items?.length) {
    const zeroTaxTotals = modifiedZeroTaxSubTotal(without_tax_items);
    for (let key in zeroTaxTotals) {
      zeroTaxSubtotal.push({
        "cbc:TaxableAmount": {
          "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
          "#text": roundingNumber(
            acceptWarning,
            zeroTaxTotals[key].total_taxable_amount
          ),
        },
        "cbc:TaxAmount": {
          "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
          "#text": ZatcaMath.monetary(zeroTaxTotals[key].total_tax_amount),
        },

        "cac:TaxCategory": {
          "cbc:ID": {
            "@_schemeAgencyID": 6,
            "@_schemeID": "UN/ECE 5305",
            "#text": key,
          },
          "cbc:Percent": 0.0,
          "cbc:TaxExemptionReasonCode": zeroTaxTotals[key].reason_code,
          "cbc:TaxExemptionReason": zeroTaxTotals[key].reason,
          "cac:TaxScheme": {
            "cbc:ID": {
              "@_schemeAgencyID": "6",
              "@_schemeID": "UN/ECE 5153",
              "#text": "VAT",
            },
          },
        },
      });
    }
  }

  const fiveTaxSubTotal: CACTaxableAmount = {
    taxable_amount: new Decimal(0),
    tax_amount: new Decimal(0),
    exist: false,
  };
  const fifteenTaxSubTotal: CACTaxableAmount = {
    taxable_amount: new Decimal(0),
    tax_amount: new Decimal(0),
    exist: false,
  };

  const addTaxSubtotal = (
    taxable_amount: Decimal.Value,
    tax_amount: Decimal.Value,
    tax_percent: number
  ) => {
    if (tax_percent == 0) return;
    if (tax_percent == 0.05) {
      fiveTaxSubTotal.taxable_amount = fiveTaxSubTotal.taxable_amount.plus(taxable_amount);
      fiveTaxSubTotal.tax_amount = fiveTaxSubTotal.tax_amount.plus(tax_amount);
      fiveTaxSubTotal.exist = true;
    } else if (tax_percent == 0.15) {
      fifteenTaxSubTotal.taxable_amount = fifteenTaxSubTotal.taxable_amount.plus(taxable_amount);
      fifteenTaxSubTotal.tax_amount = fifteenTaxSubTotal.tax_amount.plus(tax_amount);
      fifteenTaxSubTotal.exist = true;
    }
  };

  let taxes_total = new Decimal(0);

  line_items.map((line_item) => {
    const { line_extension_amount, line_item_total_taxes } = computeLineAmounts(line_item);

    addTaxSubtotal(line_extension_amount, line_item_total_taxes, line_item.VAT_percent);
    taxes_total = taxes_total.plus(line_item_total_taxes);

    line_item.other_taxes?.map((tax) => {
      const other_tax_amount = ZatcaMath.monetary(
        new Decimal(tax.percent_amount).times(line_extension_amount)
      );
      addTaxSubtotal(line_extension_amount, other_tax_amount, tax.percent_amount);
      taxes_total = taxes_total.plus(other_tax_amount);
    });
  });

  if (fifteenTaxSubTotal.exist) {
    cacTaxSubtotal.push({
      "cbc:TaxableAmount": {
        "@_currencyID": "SAR",
        "#text": ZatcaMath.addMonetary(fifteenTaxSubTotal.taxable_amount),
      },
      "cbc:TaxAmount": {
        "@_currencyID": "SAR",
        "#text": ZatcaMath.addMonetary(fifteenTaxSubTotal.tax_amount),
      },
      "cac:TaxCategory": {
        "cbc:ID": {
          "@_schemeAgencyID": 6,
          "@_schemeID": "UN/ECE 5305",
          "#text": ZATCA_CONSTANTS.VAT_CATEGORY_STANDARD,
        },
        "cbc:Percent": 15,
        "cac:TaxScheme": {
          "cbc:ID": {
            "@_schemeAgencyID": "6",
            "@_schemeID": "UN/ECE 5153",
            "#text": "VAT",
          },
        },

      },
    });
  }
  if (fiveTaxSubTotal.exist) {
    cacTaxSubtotal.push({
      "cbc:TaxableAmount": {
        "@_currencyID": "SAR",
        "#text": ZatcaMath.addMonetary(fiveTaxSubTotal.taxable_amount),
      },
      "cbc:TaxAmount": {
        "@_currencyID": "SAR",
        "#text": ZatcaMath.addMonetary(fiveTaxSubTotal.tax_amount),
      },
      "cac:TaxCategory": {
        "cbc:ID": {
          "@_schemeAgencyID": 6,
          "@_schemeID": "UN/ECE 5305",
          "#text": ZATCA_CONSTANTS.VAT_CATEGORY_STANDARD,
        },
        "cbc:Percent": 5,
        "cac:TaxScheme": {
          "cbc:ID": {
            "@_schemeAgencyID": "6",
            "@_schemeID": "UN/ECE 5153",
            "#text": "VAT",
          },
        },

      },
    });
  }

  const taxes_total_text = ZatcaMath.addMonetary(taxes_total);

  return {
    cacTaxTotal: [
      {
        "cbc:TaxAmount": {
          "@_currencyID": "SAR",
          "#text": taxes_total_text,
        },
        "cac:TaxSubtotal": cacTaxSubtotal.concat(zeroTaxSubtotal),
      },
      {
        "cbc:TaxAmount": {
          "@_currencyID": "SAR",
          "#text": taxes_total_text,
        },
      },
    ],
    taxes_total: taxes_total_text,
  };
};

const constructLegalMonetaryTotal = (
  total_line_extension_amount: Decimal.Value,
  total_tax: Decimal.Value
) => {
  const taxExclusiveAmount = ZatcaMath.addMonetary(total_line_extension_amount);
  const taxInclusiveAmount = ZatcaMath.addMonetary(taxExclusiveAmount, total_tax);
  return {
    "cbc:LineExtensionAmount": {
      "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
      "#text": taxExclusiveAmount,
    },
    "cbc:TaxExclusiveAmount": {
      "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
      "#text": taxExclusiveAmount,
    },
    "cbc:TaxInclusiveAmount": {
      "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
      "#text": taxInclusiveAmount,
    },
    "cbc:PrepaidAmount": {
      "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
      "#text": 0,
    },
    "cbc:PayableAmount": {
      "@_currencyID": ZATCA_CONSTANTS.CURRENCY_CODE,
      "#text": taxInclusiveAmount,
    },

  };
};

export const Calc = (
  line_items: ZATCAInvoiceLineItem[],
  props: ZATCAInvoiceProps,
  invoice_xml: XMLDocument,
  acceptWarning: boolean
) => {
  let total_taxes = new Decimal(0);
  let total_extension_amount = new Decimal(0);

  let invoice_line_items: any[] = [];

  line_items.map((line_item) => {
    line_item.tax_exclusive_price = ZatcaMath.truncateNumber(line_item.tax_exclusive_price, 14);
    const { line_item_xml, line_item_totals } = constructLineItem(
      line_item,
      acceptWarning
    );
    total_taxes = total_taxes.plus(line_item_totals.taxes_total);
    total_extension_amount = total_extension_amount.plus(line_item_totals.extension_amount);
    invoice_line_items.push(line_item_xml);
  });

  if (
    (props.invoice_type == "381" || props.invoice_type == "383") &&
    props.cancelation
  ) {
    invoice_xml.set("Invoice/cac:PaymentMeans", false, {
      "cbc:PaymentMeansCode": props.cancelation.payment_method,
      "cbc:InstructionNote": props.cancelation.reason ?? "No note Specified",
    });
  }

  const taxTotalDetails = constructTaxTotal(line_items, acceptWarning);
  invoice_xml.set("Invoice/cac:TaxTotal", false, taxTotalDetails.cacTaxTotal);

  invoice_xml.set(
    "Invoice/cac:LegalMonetaryTotal",
    true,
    constructLegalMonetaryTotal(total_extension_amount, total_taxes)
  );

  invoice_line_items.map((line_item) => {
    invoice_xml.set("Invoice/cac:InvoiceLine", false, line_item);
  });
};
