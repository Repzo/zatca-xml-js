import { XMLDocument } from "../parser";
import { Calc } from "./calc.js";
import { generateSignedXMLString } from "./signing";
import defaultSimplifiedTaxInvoice, {
  ZATCAInvoiceLineItem,
  ZATCAInvoiceProps,
  ZATCAInvoiceTypes,
  ZATCAPaymentMethods,
} from "./templates/simplified_tax_invoice_template";

export {
  ZATCAInvoiceLineItem,
  ZATCAInvoiceProps,
  ZATCAInvoiceTypes,
  ZATCAPaymentMethods,
};
export class ZATCAInvoice {
  private invoice_xml: XMLDocument;

  /**
   * Parses a ZATCA Simplified Tax Invoice XML string. Or creates a new one based on given props.
   * @param invoice_xml_str Invoice XML string to parse.
   * @param props ZATCASimplifiedInvoiceProps props to create a new unsigned invoice.
   */
  constructor({
    invoice_xml_str,
    props,
    acceptWarning,
  }: {
    invoice_xml_str?: string;
    props?: ZATCAInvoiceProps;
    acceptWarning?: boolean;
  }) {
    if (invoice_xml_str) {
      this.invoice_xml = new XMLDocument(invoice_xml_str);
      if (!this.invoice_xml)
        throw new Error("Error parsing invoice XML string.");
    } else {
      if (!props) throw new Error("Unable to create new XML invoice.");
      this.invoice_xml = new XMLDocument(defaultSimplifiedTaxInvoice(props));

      // Parsing
      this.parseLineItems(props.line_items ?? [], props, acceptWarning);
    }
  }

  private parseLineItems(
    line_items: ZATCAInvoiceLineItem[],
    props: ZATCAInvoiceProps,
    acceptWarning: boolean = false
  ) {
    Calc(line_items, props, this.invoice_xml, acceptWarning);
  }

  getXML(): XMLDocument {
    return this.invoice_xml;
  }

  /**
   * Signs the invoice.
   * @param certificate_string String signed EC certificate.
   * @param private_key_string String ec-secp256k1 private key;
   * @returns String signed invoice xml, includes QR generation.
   */
  sign(certificate_string: string, private_key_string: string) {
    return generateSignedXMLString({
      invoice_xml: this.invoice_xml,
      certificate_string: certificate_string,
      private_key_string: private_key_string,
    });
  }
}
