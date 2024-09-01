import { render } from "mustache";
import { EGSUnitInfo } from "../egs";
import defaultBillingReference from "./invoice_billing_reference_template";

/**
 * Maybe use a templating engine instead of str replace.
 * This works for now though 
 * 
 * cbc:InvoiceTypeCode: 388: BR-KSA-05 Tax Invoice according to UN/CEFACT codelist 1001, D.16B for KSA.
 *  name="0211010": BR-KSA-06 starts with "02" Simplified Tax Invoice. Also explains other positions.
 * cac:AdditionalDocumentReference: ICV: KSA-16, BR-KSA-33 (Invoice Counter number)
 */
const template = /* XML */`
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"><ext:UBLExtensions>SET_UBL_EXTENSIONS_STRING</ext:UBLExtensions>
    
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>{{{invoice_serial_number}}}</cbc:ID>
    <cbc:UUID>{{{egs_info.uuid}}}</cbc:UUID>
    <cbc:IssueDate>{{{issue_date}}}</cbc:IssueDate>
    <cbc:IssueTime>{{{issue_time}}}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="{{{invoice_code}}}">{{{invoice_type}}}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    {{#cancelation}}
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>{{{cancelation.canceled_serial_invoice_number}}}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>
    {{/cancelation}}
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>{{{invoice_counter_number}}}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">{{{previous_invoice_hash}}}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">SET_QR_CODE_DATA</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>
    <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">{{{egs_info.CRN_number}}}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
      {{#egs_info.location.street}}
        <cbc:StreetName>{{{egs_info.location.street}}}</cbc:StreetName>
      {{/egs_info.location.street}}
      {{#egs_info.location.building}}
        <cbc:BuildingNumber>{{{egs_info.location.building}}}</cbc:BuildingNumber>
      {{/egs_info.location.building}}
      {{#egs_info.location.plot_identification}}
        <cbc:PlotIdentification>{{{egs_info.location.plot_identification}}}</cbc:PlotIdentification>
      {{/egs_info.location.plot_identification}}
      {{#egs_info.location.city_subdivision}}
        <cbc:CitySubdivisionName>{{{egs_info.location.city_subdivision}}}</cbc:CitySubdivisionName>
      {{/egs_info.location.city_subdivision}}
      {{#egs_info.location.city}}
        <cbc:CityName>{{{egs_info.location.city}}}</cbc:CityName>
      {{/egs_info.location.city}}
      {{#egs_info.location.postal_zone}}
        <cbc:PostalZone>{{{egs_info.location.postal_zone}}}</cbc:PostalZone>
      {{/egs_info.location.postal_zone}}
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>{{{egs_info.VAT_number}}}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>{{{egs_info.VAT_name}}}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
  {{#egs_info.customer_info}}
    <cac:Party>
        <cac:PartyIdentification>
          <cbc:ID schemeID="CRN">{{{egs_info.customer_info.CRN_number}}}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PostalAddress>
          {{#egs_info.customer_info.street}}
            <cbc:StreetName>{{{egs_info.customer_info.street}}}</cbc:StreetName>
          {{/egs_info.customer_info.street}}
          {{#egs_info.customer_info.additional_street}}
            <cbc:AdditionalStreetName>{{{egs_info.customer_info.additional_street}}}</cbc:AdditionalStreetName>
          {{/egs_info.customer_info.additional_street}}
          {{#egs_info.customer_info.building}}
            <cbc:BuildingNumber>{{{egs_info.customer_info.building}}}</cbc:BuildingNumber>
          {{/egs_info.customer_info.building}}
          {{#egs_info.customer_info.plot_identification}}
            <cbc:PlotIdentification>{{{egs_info.customer_info.plot_identification}}}</cbc:PlotIdentification>
          {{/egs_info.customer_info.plot_identification}}
          {{#egs_info.customer_info.city_subdivision}}
            <cbc:CitySubdivisionName>{{{egs_info.customer_info.city_subdivision}}}</cbc:CitySubdivisionName>
          {{/egs_info.customer_info.city_subdivision}}
          {{#egs_info.customer_info.city}}
            <cbc:CityName>{{{egs_info.customer_info.city}}}</cbc:CityName>
          {{/egs_info.customer_info.city}}
          {{#egs_info.customer_info.postal_zone}}
            <cbc:PostalZone>{{{egs_info.customer_info.postal_zone}}}</cbc:PostalZone>
          {{/egs_info.customer_info.postal_zone}}
          {{#egs_info.customer_info.country_sub_entity}}
            <cbc:CountrySubentity>{{{egs_info.customer_info.country_sub_entity}}}</cbc:CountrySubentity>
          {{/egs_info.customer_info.country_sub_entity}}
            <cac:Country>
                <cbc:IdentificationCode>SA</cbc:IdentificationCode>
            </cac:Country>
        </cac:PostalAddress>
        {{#egs_info.customer_info.vat_number}}
        <cac:PartyTaxScheme>
          <cbc:CompanyID>{{{egs_info.customer_info.vat_number}}}</cbc:CompanyID>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>
        {{/egs_info.customer_info.vat_number}}
        <cac:PartyLegalEntity>
            <cbc:RegistrationName>{{{egs_info.customer_info.buyer_name}}}</cbc:RegistrationName>
        </cac:PartyLegalEntity>
    </cac:Party>
  {{/egs_info.customer_info}}
  </cac:AccountingCustomerParty>
  {{#actual_delivery_date}}
  <cac:Delivery>
    <cbc:ActualDeliveryDate>{{{actual_delivery_date}}}</cbc:ActualDeliveryDate>
    {{#latest_delivery_date}}
    <cbc:LatestDeliveryDate>{{{latest_delivery_date}}}</cbc:LatestDeliveryDate>
    {{/latest_delivery_date}}
  </cac:Delivery>
  {{/actual_delivery_date}}
  {{^cancelation}}
  {{#payment_method}}
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>{{{payment_method}}}</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  {{/payment_method}}
  {{/cancelation}}
</Invoice>`;

// 11.2.5 Payment means type code
export enum ZATCAPaymentMethods {
  CASH="10",
  CREDIT="30",
  BANK_ACCOUNT="42",
  BANK_CARD="48"
}

export enum ZATCAInvoiceTypes{
  INVOICE="388",
  DEBIT_NOTE="383",
  CREDIT_NOTE="381"
}

export interface ZATCAInvoiceLineItemDiscount {
  amount: number,
  reason: string
}

export interface ZATCAInvoiceLineItemTax {
  percent_amount: number
}

interface InvoiceLineItem {
  id: string;
  name: string;
  quantity: number;
  tax_exclusive_price: number;
  other_taxes?: ZATCAInvoiceLineItemTax[];
  discounts?: ZATCAInvoiceLineItemDiscount[]
}

type ZeroTaxLineItem = InvoiceLineItem & {
  VAT_percent: 0;
  vat_category: { 
    code: "O" | "Z" | "E";
    reason_code?: string; 
    reason?: string 
  }
}

type LineItem = InvoiceLineItem & {
  VAT_percent: 0.15 | 0.05
}

export type ZATCAInvoiceLineItem = LineItem | ZeroTaxLineItem

export interface ZATCAInvoicCancelation {
  canceled_serial_invoice_number: string;
  payment_method: ZATCAPaymentMethods;
  reason: string;
}

interface ZatcaInvoice{
  egs_info: EGSUnitInfo;
  invoice_counter_number: number;
  invoice_serial_number: string;
  issue_date: string;
  issue_time: string;
  previous_invoice_hash: string;
  line_items: ZATCAInvoiceLineItem[];
}

type CreditDebitInvoice = ZatcaInvoice & {
  invoice_type: ZATCAInvoiceTypes.CREDIT_NOTE | ZATCAInvoiceTypes.DEBIT_NOTE;
  cancelation: ZATCAInvoicCancelation;
};

type CashInvoice = ZatcaInvoice & {
  invoice_type: ZATCAInvoiceTypes.INVOICE;
  actual_delivery_date?: string;
  latest_delivery_date?: string;
  payment_method?: "10" | "30" | "42" | "48"; // CASH="10", CREDIT="30", BANK_ACCOUNT="42", BANK_CARD="48"
};

type TaxInvoice = (CashInvoice | CreditDebitInvoice) & {
  invoice_code: "0100000";
  actual_delivery_date?: string;
};

type SimplifiedInvoice = (CashInvoice | CreditDebitInvoice) & {
  invoice_code: "0200000";
};

export type ZATCAInvoiceProps = SimplifiedInvoice | TaxInvoice;

const rendering = (props: ZATCAInvoiceProps): string => {
  let result = render(template, props);
  return result;
};

export default function populate(props: ZATCAInvoiceProps): string {
  const populated_template = rendering(props);
  return populated_template;
}
