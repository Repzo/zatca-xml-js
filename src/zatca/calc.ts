import {
  ZATCAInvoiceLineItem,
  ZATCAInvoiceProps,
} from "./ZATCASimplifiedTaxInvoice";
import { XMLDocument } from "../parser";
import Decimal from "decimal.js";

interface CACTaxableAmount {
  tax_amount: number;
  taxable_amount: number;
  exist: boolean;
}

const constructLineItemTotals = (line_item: ZATCAInvoiceLineItem) => {
  let line_discounts = 0;
  let cacAllowanceCharges: any[] = [];
  let cacClassifiedTaxCategories: any[] = [];
  let cacTaxTotal = {};

  const VAT = {
    "cbc:ID": line_item.VAT_percent ? "S" : line_item.vat_category?.code,
    "cbc:Percent": line_item.VAT_percent
      ? (line_item.VAT_percent * 100).toString()
      : 0.0,
    "cac:TaxScheme": {
      "cbc:ID": "VAT",
    },
  };
  cacClassifiedTaxCategories.push(VAT);

  line_item.discounts?.map((discount) => {
    line_discounts += discount.amount;
    cacAllowanceCharges.push({
      "cbc:ChargeIndicator": "false",
      "cbc:AllowanceChargeReason": discount.reason,
      "cbc:Amount": {
        "@_currencyID": "SAR",
        "#text": new Decimal(discount.amount).toFixed(14),
      },
      "cbc:BaseAmount": {
        "@_currencyID": "SAR",
        "#text": line_item.tax_exclusive_price,
      },
    });
  });

  line_discounts = Number(new Decimal(line_discounts).toFixed(14));
  let line_extension_amount = Number(
    new Decimal(
      line_item.quantity * (line_item.tax_exclusive_price - line_discounts)
    ).toFixed(2)
  );
  let line_item_total_taxes = Number(
    new Decimal(line_extension_amount * line_item.VAT_percent).toFixed(2)
  );

  cacTaxTotal = {
    "cbc:TaxAmount": {
      "@_currencyID": "SAR",
      "#text": new Decimal(line_item_total_taxes).toFixed(2),
    },
    "cbc:RoundingAmount": {
      "@_currencyID": "SAR",
      "#text": new Decimal(
        line_extension_amount + line_item_total_taxes
      ).toFixed(2),
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

const constructLineItem = (line_item: ZATCAInvoiceLineItem) => {
  const {
    cacAllowanceCharges,
    cacClassifiedTaxCategories,
    cacTaxTotal,
    line_item_total_taxes,
    line_discounts,
    line_extension_amount,
  } = constructLineItemTotals(line_item);

  return {
    line_item_xml: {
      "cbc:ID": line_item.id,
      "cbc:InvoicedQuantity": {
        "@_unitCode": "PCE",
        "#text": line_item.quantity,
      },
      "cbc:LineExtensionAmount": {
        "@_currencyID": "SAR",
        "#text": new Decimal(line_extension_amount).toString(),
      },
      "cac:TaxTotal": cacTaxTotal,
      "cac:Item": {
        "cbc:Name": line_item.name,
        "cac:ClassifiedTaxCategory": cacClassifiedTaxCategories,
      },
      "cac:Price": {
        "cbc:PriceAmount": {
          "@_currencyID": "SAR",
          "#text": new Decimal(
            line_item.tax_exclusive_price - line_discounts
          ).toFixed(14),
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

const constructTaxTotal = (line_items: ZATCAInvoiceLineItem[]) => {
  const cacTaxSubtotal: any[] = [];
  const zeroTaxSubtotal: any[] = [];

  const without_tax_items = line_items.filter((item) => item.VAT_percent == 0);
  const modifiedZeroTaxSubTotal = (items: ZATCAInvoiceLineItem[]) => {
    let zeroTaxObj: {
      [key: string]: {
        total_taxable_amount: number;
        total_tax_amount: number;
        reason: string;
        reason_code: string;
      };
    } = {};

    items.forEach((item) => {
      if (item.VAT_percent != 0) return;
      let total_line_item_discount =
        item.discounts?.reduce((p, c) => p + c.amount, 0) || 0;

      const taxable_amount = Number(
        new Decimal(
          (item.tax_exclusive_price - total_line_item_discount) * item.quantity
        ).toFixed(2)
      );
      let tax_amount = Number(new Decimal(item.VAT_percent * taxable_amount));

      let code = item.vat_category.code;
      if (code && zeroTaxObj.hasOwnProperty(code)) {
        zeroTaxObj[code].total_tax_amount += tax_amount;
        zeroTaxObj[code].total_taxable_amount += taxable_amount;
      } else if (code && !zeroTaxObj.hasOwnProperty(code)) {
        zeroTaxObj[code] = {
          total_tax_amount: tax_amount,
          total_taxable_amount: taxable_amount,
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
          "@_currencyID": "SAR",
          "#text": new Decimal(
            zeroTaxTotals[key].total_taxable_amount
          ).toString(),
        },
        "cbc:TaxAmount": {
          "@_currencyID": "SAR",
          "#text": new Decimal(zeroTaxTotals[key].total_tax_amount).toString(),
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
    taxable_amount: 0,
    tax_amount: 0,
    exist: false,
  };
  const fifteenTaxSubTotal: CACTaxableAmount = {
    taxable_amount: 0,
    tax_amount: 0,
    exist: false,
  };

  const addTaxSubtotal = (
    taxable_amount: number,
    tax_amount: number,
    tax_percent: number
  ) => {
    if (tax_percent == 0) return;
    if (tax_percent == 0.05) {
      fiveTaxSubTotal.taxable_amount += taxable_amount;
      fiveTaxSubTotal.tax_amount += tax_amount;
      fiveTaxSubTotal.exist = true;
    } else if (tax_percent == 0.15) {
      fifteenTaxSubTotal.taxable_amount += taxable_amount;
      fifteenTaxSubTotal.tax_amount += tax_amount;
      fifteenTaxSubTotal.exist = true;
    }
  };

  let taxes_total = 0;

  line_items.map((line_item) => {
    let total_line_item_discount =
      line_item.discounts?.reduce((p, c) => p + c.amount, 0) || 0;

    total_line_item_discount = Number(
      new Decimal(total_line_item_discount).toFixed(14)
    );
    const taxable_amount = Number(
      new Decimal(
        (line_item.tax_exclusive_price - total_line_item_discount) *
          line_item.quantity
      ).toFixed(2)
    );

    let tax_amount = Number(
      new Decimal(line_item.VAT_percent * taxable_amount).toFixed(2)
    );

    addTaxSubtotal(taxable_amount, tax_amount, line_item.VAT_percent);
    taxes_total += parseFloat(new Decimal(tax_amount).toString());

    line_item.other_taxes?.map((tax) => {
      tax_amount = tax.percent_amount * taxable_amount;
      addTaxSubtotal(taxable_amount, tax_amount, tax.percent_amount);
      taxes_total += parseFloat(tax_amount.toString());
    });
  });

  if (fifteenTaxSubTotal.exist) {
    cacTaxSubtotal.push({
      "cbc:TaxableAmount": {
        "@_currencyID": "SAR",
        "#text": new Decimal(fifteenTaxSubTotal.taxable_amount).toFixed(2),
      },
      "cbc:TaxAmount": {
        "@_currencyID": "SAR",
        "#text": new Decimal(fifteenTaxSubTotal.tax_amount).toFixed(2),
      },
      "cac:TaxCategory": {
        "cbc:ID": {
          "@_schemeAgencyID": 6,
          "@_schemeID": "UN/ECE 5305",
          "#text": "S",
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
        "#text": new Decimal(fiveTaxSubTotal.taxable_amount).toFixed(2),
      },
      "cbc:TaxAmount": {
        "@_currencyID": "SAR",
        "#text": new Decimal(fiveTaxSubTotal.tax_amount).toFixed(2),
      },
      "cac:TaxCategory": {
        "cbc:ID": {
          "@_schemeAgencyID": 6,
          "@_schemeID": "UN/ECE 5305",
          "#text": "S",
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
  taxes_total = parseFloat(new Decimal(taxes_total).toFixed(2));

  return {
    cacTaxTotal: [
      {
        "cbc:TaxAmount": {
          "@_currencyID": "SAR",
          "#text": new Decimal(taxes_total).toFixed(2),
        },
        "cac:TaxSubtotal": cacTaxSubtotal.concat(zeroTaxSubtotal),
      },
      {
        "cbc:TaxAmount": {
          "@_currencyID": "SAR",
          "#text": new Decimal(taxes_total).toFixed(2),
        },
      },
    ],
    taxes_total,
  };
};

// const constructAllowanceCharge = (line_items: ZATCAInvoiceLineItem[]) => {
//   const cacAllowanceCharge: any[] = [];
//   const addAllowanceCharge = (line_item: ZATCAInvoiceLineItem) => {
//     cacAllowanceCharge.push({
//       "cbc:ChargeIndicator": "false",
//       "cbc:AllowanceChargeReason": "discount",
//       "cbc:Amount": {
//         "@_currencyID": "SAR",
//         "#text": new Decimal(
//           line_item.discounts?.reduce((acc, dis) => dis.amount + acc, 0) || 0
//         ).toString(),
//       },
//       "cac:TaxCategory": {
//         "cbc:ID": {
//           "@_schemeAgencyID": 6,
//           "@_schemeID": "UN/ECE 5305",
//           "#text": line_item.VAT_percent ? "S" : line_item.vat_category?.code,
//         },
//         "cbc:Percent": new Decimal(line_item.VAT_percent * 100).toString(),
//         "cac:TaxScheme": {
//           "cbc:ID": {
//             "@_schemeAgencyID": "6",
//             "@_schemeID": "UN/ECE 5153",
//             "#text": "VAT",
//           },
//         },
//       },
//     });
//   };
//   line_items.forEach((line_item) => {
//     addAllowanceCharge(line_item);
//   });
//   return cacAllowanceCharge;
// };

const constructLegalMonetaryTotal = (
  total_line_extension_amount: number,
  total_tax: number
) => {
  let taxExclusiveAmount = total_line_extension_amount;
  let taxInclusiveAmount = taxExclusiveAmount + total_tax;
  return {
    "cbc:LineExtensionAmount": {
      "@_currencyID": "SAR",
      "#text": new Decimal(total_line_extension_amount).toFixed(2),
    },
    "cbc:TaxExclusiveAmount": {
      "@_currencyID": "SAR",
      "#text": new Decimal(taxExclusiveAmount).toFixed(2),
    },
    "cbc:TaxInclusiveAmount": {
      "@_currencyID": "SAR",
      "#text": new Decimal(taxInclusiveAmount).toFixed(2),
    },
    // "cbc:AllowanceTotalAmount": {
    //   "@_currencyID": "SAR",
    //   "#text": new Decimal(total_discounts).toFixed(2),
    // },
    "cbc:PrepaidAmount": {
      "@_currencyID": "SAR",
      "#text": 0,
    },
    "cbc:PayableAmount": {
      "@_currencyID": "SAR",
      "#text": new Decimal(taxInclusiveAmount).toFixed(2),
    },
  };
};

export const Calc = (
  line_items: ZATCAInvoiceLineItem[],
  props: ZATCAInvoiceProps,
  invoice_xml: XMLDocument
) => {
  let total_taxes: number = 0;
  let total_extension_amount: number = 0;
  let total_discounts: number = 0;

  let invoice_line_items: any[] = [];

  line_items.map((line_item) => {
    line_item.tax_exclusive_price = Number(
      new Decimal(line_item.tax_exclusive_price).toFixed(14)
    );
    const { line_item_xml, line_item_totals } = constructLineItem(line_item);
    total_taxes += line_item_totals.taxes_total;
    total_extension_amount += line_item_totals.extension_amount;
    total_discounts += line_item_totals.discounts_total;
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

  // invoice_xml.set(
  //   "Invoice/cac:AllowanceCharge",
  //   false,
  //   constructAllowanceCharge(line_items)
  // );
  const taxTotalDetails = constructTaxTotal(line_items);
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
