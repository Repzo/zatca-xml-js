# @pioneersoft/zatca-einvoice

[![npm version](https://img.shields.io/npm/v/%40pioneersoft%2Fzatca-einvoice)](https://www.npmjs.com/package/@pioneersoft/zatca-einvoice)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/%40pioneersoft%2Fzatca-einvoice)](https://www.npmjs.com/package/@pioneersoft/zatca-einvoice)

TypeScript helpers for Saudi Arabia ZATCA Phase 2 e-invoicing.

**Note:** This library is heavily inspired by and originally forked from [zatca-xml-js](https://github.com/Repzo/zatca-xml-js), enhanced with robust support for Phase 2 Production API integrations, Sandbox certificate renewals, decimal truncation stability, and enterprise reporting flows.

The package handles the ZATCA protocol domain:

- Generate secp256k1 EGS keys and CSR files
- Request compliance CSID and production CSID
- Build simplified and standard UBL invoice XML
- Apply ZATCA decimal truncation helpers
- Sign invoices with XAdES/ECDSA cryptographic stamp
- Generate ZATCA QR payloads
- Check compliance invoices
- Report simplified invoices
- Clear standard invoices
- Accept either raw ZATCA `binarySecurityToken` certificates or PEM certificates

Your application should still own persistence, private-key encryption, queues, retries, user auth, and business-model mapping.

## Installation

```bash
npm install @pioneersoft/zatca-einvoice
```

This package currently uses the OpenSSL CLI for secp256k1 key and CSR generation. Install OpenSSL on the server or container where onboarding runs.

## Minimal Concepts

- `EGS`: E-Invoice Generation System, usually one POS/device/register.
- `Compliance CSID`: sandbox/compliance certificate issued using an OTP from Fatoora portal.
- `Production CSID`: certificate used for production reporting/clearance after compliance checks.
- `ICV`: invoice counter value.
- `PIH`: previous invoice hash. The first invoice uses `ZATCA_CONSTANTS.FIRST_INVOICE_PREVIOUS_HASH`.
- Simplified invoices use reporting.
- Standard invoices use clearance.

## End-To-End Simplified Invoice Workflow

```ts
import {
  EGS,
  EGSUnitInfo,
  ZATCAInvoice,
  ZATCAInvoiceTypes,
  ZATCAPaymentMethods,
  ZATCA_CONSTANTS,
} from "@pioneersoft/zatca-einvoice";

const egsInfo: EGSUnitInfo = {
  uuid: "6f4d20e0-6bfe-4a80-9389-7dabe6620f14",
  custom_id: "TST-POS-001",
  model: "POS",
  CRN_number: "1234567890",
  VAT_name: "Example Trading Company",
  VAT_number: "399999999900003",
  branch_name: "Main Branch",
  branch_industry: "FoodAndBeverages",
  invoice_type: "0100", // 0100 simplified, 1000 standard, 1100 both
  location: {
    building: "1234",
    street: "King Fahd Road",
    city: "Riyadh",
    postal_zone: "12345",
  },
};

async function onboardAndReport() {
  const egs = new EGS(egsInfo, "development"); // development, simulation, production

  await egs.generateNewKeysAndCSR(false, "MyPOS");

  // Store these securely in your application database or vault.
  const privateKeyPem = egs.get().private_key!;
  const csrPem = egs.get().csr!;

  // OTP comes from ZATCA/Fatoora portal.
  const complianceRequestId = await egs.issueComplianceCertificate("123345");

  const complianceCertificate = egs.get().compliance_certificate!;
  const complianceSecret = egs.get().compliance_api_secret!;

  const invoice = new ZATCAInvoice({
    props: {
      egs_info: egsInfo,
      invoice_counter_number: 1,
      invoice_serial_number: "INV-1",
      invoice_type: ZATCAInvoiceTypes.INVOICE,
      invoice_code: "0200000",
      issue_date: "2026-05-18",
      issue_time: "10:00:00",
      previous_invoice_hash: ZATCA_CONSTANTS.FIRST_INVOICE_PREVIOUS_HASH,
      payment_method: ZATCAPaymentMethods.CASH,
      line_items: [
        {
          id: "1",
          name: "Coffee",
          quantity: 2,
          tax_exclusive_price: 10,
          VAT_percent: 0.15,
        },
      ],
    },
  });

  const complianceSigned = egs.signInvoice(
    invoice,
    false,
    "2026-05-18T10:00:00Z"
  );
  await egs.checkInvoiceCompliance(
    complianceSigned.signed_invoice_string,
    complianceSigned.invoice_hash
  );

  await egs.issueProductionCertificate(complianceRequestId);

  const productionCertificate = egs.get().production_certificate!;
  const productionSecret = egs.get().production_api_secret!;

  const productionEgs = new EGS(
    {
      ...egsInfo,
      private_key: privateKeyPem,
      production_certificate: productionCertificate,
      production_api_secret: productionSecret,
    },
    "development"
  );

  const signed = productionEgs.signInvoice(
    invoice,
    true,
    "2026-05-18T10:00:00Z"
  );
  const reportResponse = await productionEgs.reportInvoice(
    signed.signed_invoice_string,
    signed.invoice_hash
  );

  return {
    csrPem,
    complianceCertificate,
    complianceSecret,
    productionCertificate,
    productionSecret,
    signedXml: signed.signed_invoice_string,
    invoiceHash: signed.invoice_hash,
    qr: signed.qr,
    reportResponse,
  };
}
```

## Standard Invoice Clearance

Use `invoice_code: "0100000"` and include buyer information in `egs_info.customer_info`.

```ts
const cleared = await productionEgs.clearanceInvoice(
  signedStandardInvoiceXml,
  standardInvoiceHash
);
```

## Credit And Debit Notes

Use `ZATCAInvoiceTypes.CREDIT_NOTE` or `ZATCAInvoiceTypes.DEBIT_NOTE` and provide `cancelation`.

```ts
const creditNote = new ZATCAInvoice({
  props: {
    egs_info: egsInfo,
    invoice_counter_number: 2,
    invoice_serial_number: "CN-1",
    invoice_type: ZATCAInvoiceTypes.CREDIT_NOTE,
    invoice_code: "0200000",
    issue_date: "2026-05-18",
    issue_time: "10:10:00",
    previous_invoice_hash: previousInvoiceHash,
    cancelation: {
      canceled_serial_invoice_number: "INV-1",
      payment_method: ZATCAPaymentMethods.CASH,
      reason: "Refund",
    },
    line_items,
  },
});
```

## Production CSID Renewal

Renewal starts with the current production CSID, a fresh CSR, and a renewal OTP. The renewal API returns a renewed compliance credential pair, which you use for renewal compliance checks before requesting the final renewed production CSID.

```ts
const renewalEgs = new EGS(
  {
    ...egsInfo,
    production_certificate: currentProductionCertificate,
    production_api_secret: currentProductionSecret,
  },
  "development"
);

await renewalEgs.generateNewKeysAndCSR(false, "MyPOS");
const renewalRequestId = await renewalEgs.renewProductionCertificate("123345");

// Run the required compliance invoice checks with renewalEgs.checkInvoiceCompliance(...)
await renewalEgs.issueProductionCertificate(renewalRequestId);
```

## Certificate Formats

ZATCA APIs return `binarySecurityToken`. The library accepts both this raw token and PEM certificates.

```ts
import {
  rawTokenToPem,
  certificateToBinarySecurityToken,
} from "@pioneersoft/zatca-einvoice";

const pem = rawTokenToPem(binarySecurityToken);
const token = certificateToBinarySecurityToken(pem);
```

## Decimal Handling

ZATCA decimal rules are validation-critical. The library enforces monetary truncation during invoice XML generation and also exposes helpers.

```ts
import { ZatcaMath } from "@pioneersoft/zatca-einvoice";

ZatcaMath.monetary(10.126); // "10.12"
ZatcaMath.calculateVATAmount(10.126, 15); // 1.51
```

## CSR And Crypto Helpers

```ts
import {
  extractPublicKey,
  verifyCsr,
  extractCsrInfo,
} from "@pioneersoft/zatca-einvoice";

const publicKeyPem = extractPublicKey(privateKeyPem);
const valid = await verifyCsr(csrPem);
const csrInfo = await extractCsrInfo(csrPem);
```

`extractPublicKey` uses Node.js crypto. `verifyCsr` and `extractCsrInfo` encapsulate OpenSSL execution and return JavaScript results/errors.

## What Your Application Should Own

Keep these outside the library:

- Encrypting private keys at rest
- Database schema and persistence
- Mapping orders/carts/refunds to ZATCA invoice inputs
- Invoice counter allocation and hash-chain locking
- Queue retries and 24-hour reporting deadline policies
- HTTP error mapping, monitoring, and audit logs
- Secrets management through KMS, Vault, or your platform

## Official ZATCA References

- XML Implementation Standard v1.2: https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_XML_Implementation_Standard_%20vF.pdf
- Security Features Implementation Standard v1.2: https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_Security_Features_Implementation_Standards_vF.pdf
- Developer Portal Manual: https://sandbox.zatca.gov.sa/User_Manual_Developer_Portal_Manual_Version_3.pdf
- Sandbox: https://sandbox.zatca.gov.sa/IntegrationSandbox

## Production Checklist

- Use one EGS identity per device/register.
- Store `private_key`, CSIDs, and secrets encrypted.
- Keep an atomic invoice counter and PIH chain per EGS.
- Run required compliance checks before requesting production CSID.
- Use reporting for simplified invoices and clearance for standard invoices.
- Persist full signed XML, invoice hash, QR, ZATCA response, and status.
- Monitor certificates before expiry.
- Treat validation `ERROR` as rejected. Validation `WARNING` may still be accepted by ZATCA but should be reviewed.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branch naming, pull request expectations, and security-aware contribution guidelines.

## Security

If you believe you found a vulnerability in the library's cryptographic, XML, certificate, or API handling, follow the private reporting instructions in [SECURITY.md](SECURITY.md). Do not post private keys, CSIDs, secrets, OTPs, or real production invoice data in public issues.

## Code of Conduct

This project follows the community expectations documented in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Disclaimer

This package is not affiliated with, authorized, maintained, or endorsed by ZATCA. Always validate against the official ZATCA sandbox and current ZATCA documentation before production rollout.
