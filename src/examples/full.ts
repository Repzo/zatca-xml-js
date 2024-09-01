import { EGS, EGSUnitInfo } from "../zatca/egs";
import {
  ZATCAInvoiceLineItem,
  ZATCAInvoiceTypes,
} from "../zatca/templates/simplified_tax_invoice_template";
import { ZATCAInvoice } from "../zatca/ZATCASimplifiedTaxInvoice";


// Sample line items
const line_item_1: ZATCAInvoiceLineItem = {
  id: "1",
  name: "TEST NAME",
  quantity: 44,
  tax_exclusive_price: 22,
  VAT_percent: 0.15,
  discounts: [{ amount: 1, reason: "discount" }],
};

const line_item_2: ZATCAInvoiceLineItem = {
  id: "2",
  name: "TEST NAME 1",
  quantity: 10,
  tax_exclusive_price: 5,
  VAT_percent: 0.05,
  discounts: [{ amount: 2, reason: "discount" }],
};

const line_item_3: ZATCAInvoiceLineItem = {
  id: "3",
  name: "TEST NAME 2",
  quantity: 10,
  tax_exclusive_price: 5,
  VAT_percent: 0.0,
  vat_category: {
    code: "Z",
    reason_code: "VATEX-SA-34-4",
    reason: "Supply of a qualifying means of transport",
  },
};

// Sample EGSUnit
const egsunit: EGSUnitInfo = {
  uuid: "6f4d20e0-6bfe-4a80-9389-7dabe6620f14",
  custom_id: "EGS2",
  model: "IOS",
  CRN_number: "454634645645654",
  VAT_name: "Wesam Alzahir",
  VAT_number: "399999999900003",
  location: {
    city: "Khobar",
    city_subdivision: "West",
    street: "King Fahahd st",
    plot_identification: "0000",
    building: "0000",
    postal_zone: "31952",
  },
  customer_info: {
    city: "jeddah",
    city_subdivision: "ssss",
    buyer_name: "S7S",
    building: "00",
    postal_zone: "00000",
    street: "__",
    vat_number: "300000000000003",
  },
  branch_name: "My Branch Name",
  branch_industry: "Food",
};

// Sample Invoice
const invoice = new ZATCAInvoice({
  props: {
    egs_info: egsunit,
    invoice_counter_number: 1,
    invoice_type: ZATCAInvoiceTypes.INVOICE,
    invoice_code: "0200000",
    invoice_serial_number: "EGS1-886431145-101",
    issue_date: "2024-02-29",
    issue_time: "11:40:40",
    previous_invoice_hash: "zDnQnE05P6rFMqF1ai21V5hIRlUq/EXvrpsaoPkWRVI=",
    line_items: [line_item_1, line_item_2, line_item_3],
    actual_delivery_date: "2024-02-29",
  },
});

const main = async () => {
  try {
    // TEMP_FOLDER: Use .env or set directly here (Default: /tmp/)
    // Enable for windows
    // process.env.TEMP_FOLDER = `${require("os").tmpdir()}\\`;

    // Init a new EGS
    const egs = new EGS(egsunit);

    // New Keys & CSR for the EGS
    await egs.generateNewKeysAndCSR(false, "solution_name");

    // Issue a new compliance cert for the EGS
    const compliance_request_id = await egs.issueComplianceCertificate(
      "123345"
    );
    const production_request_id = await egs.issueProductionCertificate(
      compliance_request_id
    );

    // Sign invoice
    const { signed_invoice_string, invoice_hash, qr } = egs.signInvoice(
      invoice,
      true
    );
    // Check invoice compliance
    console.log(
      await egs.checkInvoiceCompliance(signed_invoice_string, invoice_hash)
    );

    // Issue production certificate
    // Report invoice production
    // Note: This request currently fails because ZATCA sandbox returns a constant fake production certificate
    let response = await egs.reportInvoice(signed_invoice_string, invoice_hash);
    console.log(JSON.stringify(response));
  } catch (error: any) {
    console.log(error.message ?? error);
    console.log(JSON.stringify(error.response?.data));
  }
};

main();