import {
  EGS,
  EGSUnitInfo,
  ZATCAInvoice,
  ZATCA_CONSTANTS,
  ZATCAInvoiceLineItem,
  ZATCAInvoiceTypes,
  ZATCAPaymentMethods,
  ZatcaMath,
  extractCsrInfo,
  verifyCsr,
  isPemCertificate,
  generatePhaseOneQR
} from "../index";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * ==============================================================================
 * @pioneersoft/zatca-einvoice - Comprehensive End-to-End Test and Demonstration
 * ==============================================================================
 *
 * This file serves as a complete reference implementation demonstrating all major
 * library functionalities in a real-world flow.
 *
 * It covers:
 * 1. Cryptographic utilities (Math, Crypto, Certificate Handling)
 * 2. EGS Onboarding (CSR Generation, Key Pair, Compliance & Production CSIDs)
 * 3. CSID Renewal (Sandbox Renewal Flow)
 * 4. Invoice Creation (Tax Invoices and Simplified Tax Invoices with Line Items)
 * 5. XML Generation and Cryptographic Signing (Digital Signatures, UBL Extensions)
 * 6. QR Code Generation (Phase 1 & Phase 2)
 * 7. ZATCA API Integration (Compliance Check, Reporting, Clearance)
 */

// ------------------------------------------------------------------------------
// 1. Setup EGS (Electronic Generation System) Information
// ------------------------------------------------------------------------------
// This mimics the configuration typically stored in your database for a branch/outlet.
const egsUnit: EGSUnitInfo = {
  uuid: "6f4d20e0-6bfe-4a80-9389-7dabe6620f14",
  custom_id: "POS-01",
  model: "POS-Terminal-v1",
  CRN_number: "1234567890", // Must be exactly 10 digits
  VAT_name: "PioneerSoft Saudi Arabia",
  VAT_number: "399999999900003", // Must be 15 digits starting and ending with 3
  branch_name: "Riyadh Main Branch",
  branch_industry: "Software Development",
  location: {
    city: "Riyadh",
    city_subdivision: "Al Olaya",
    street: "King Fahd Road",
    plot_identification: "1234",
    building: "1111",
    postal_zone: "12214",
  },
  // Optional customer info for B2B (Tax Invoices)
  customer_info: {
    buyer_name: "Acme Corporation",
    customer_crn_number: "0987654321",
    vat_number: "300000000000003",
    city: "Jeddah",
    city_subdivision: "Al Balad",
    street: "King Abdulaziz St",
    building: "2222",
    postal_zone: "21514",
  },
};

// ------------------------------------------------------------------------------
// 2. Define Sample Line Items
// ------------------------------------------------------------------------------
// These represent the cart items at checkout.
const sampleLineItems: ZATCAInvoiceLineItem[] = [
  {
    id: "1",
    name: "Software License",
    quantity: 2,
    tax_exclusive_price: 500, // 500 SAR per unit
    VAT_percent: 0.15, // 15% Standard VAT
    discounts: [
      {
        amount: 50, // 50 SAR discount
        reason: "Promotional Discount",
      },
    ],
  },
  {
    id: "2",
    name: "Support Services",
    quantity: 1,
    tax_exclusive_price: 1000,
    VAT_percent: 0.05, // 5% VAT (Special Category)
  },
  {
    id: "3",
    name: "Exported Goods",
    quantity: 5,
    tax_exclusive_price: 200,
    VAT_percent: 0, // 0% Zero-rated VAT
    vat_category: {
      code: ZATCA_CONSTANTS.VAT_CATEGORY_ZERO,
      reason_code: "VATEX-SA-32",
      reason: "Export of goods",
    },
  },
];


const main = async () => {
  console.log("==============================================================================");
  console.log("🚀 Starting ZATCA E-Invoicing End-to-End Demonstration");
  console.log("==============================================================================\\n");

  try {
    // ------------------------------------------------------------------------------
    // ENVIRONMENT SETUP
    // ------------------------------------------------------------------------------
    // OpenSSL requires a temp folder for writing intermediary files during CSR generation.
    process.env.TEMP_FOLDER = os.tmpdir() + path.sep;
    
    // Choose environment: "development" (Sandbox), "simulation", or "production"
    const ENVIRONMENT = "development";
    console.log(`[Setup] Environment: ${ENVIRONMENT.toUpperCase()}`);

    // Initialize the EGS instance
    const egs = new EGS(egsUnit, ENVIRONMENT);
    console.log(`[Setup] EGS Instance initialized for UUID: ${egs.get().uuid}\\n`);


    // ------------------------------------------------------------------------------
    // UTILITY DEMONSTRATION
    // ------------------------------------------------------------------------------
    console.log("--- Utility Demonstrations ---");
    const netAmount = 1000.556;
    const vatPercent = 15;
    
    // Math Utilities (Ensuring strict compliance with ZATCA rounding rules)
    console.log(`[Math] Truncated (1000.556): ${ZatcaMath.truncate(netAmount, 2)}`);
    console.log(`[Math] Calculate VAT (15% of 1000.556): ${ZatcaMath.calculateVATAmount(netAmount, vatPercent)}`);
    console.log(`[Math] Line Total with VAT: ${ZatcaMath.calculateLineTotalWithVAT(netAmount, ZatcaMath.calculateVATAmount(netAmount, vatPercent))}\\n`);


    // ------------------------------------------------------------------------------
    // ONBOARDING FLOW: KEYS & CSR GENERATION
    // ------------------------------------------------------------------------------
    console.log("--- Phase 1: Onboarding (CSR & Key Generation) ---");
    // Generate Secp256k1 Keys and CSR (false = compliance CSR, true = production CSR)
    console.log("[Crypto] Generating Secp256k1 KeyPair and CSR via OpenSSL...");
    await egs.generateNewKeysAndCSR(false, "PioneerSoft-ERP");
    
    const egsData = egs.get();
    
    if (egsData.csr) {
      console.log("[Crypto] Keys and CSR generated successfully.");
      
      // Verify CSR properties using our Crypto utilities
      const isValidCsr = await verifyCsr(egsData.csr);
      console.log(`[Crypto] CSR Signature Verified: ${isValidCsr}`);
      
      const csrInfo = await extractCsrInfo(egsData.csr);
      console.log(`[Crypto] CSR Subject: ${csrInfo.subject}`);
    } else {
      throw new Error("CSR generation failed.");
    }
    console.log("");


    // ------------------------------------------------------------------------------
    // ONBOARDING FLOW: COMPLIANCE & PRODUCTION CSIDS
    // ------------------------------------------------------------------------------
    console.log("--- Phase 2: ZATCA CSID Issuance ---");
    // Standard testing OTP for ZATCA sandbox is usually '123345'. 
    // In production, this is obtained from the Fatoora portal.
    const OTP = "123345";
    
    console.log(`[API] Requesting Compliance CSID with OTP: ${OTP}...`);
    const complianceRequestId = await egs.issueComplianceCertificate(OTP);
    console.log(`[API] Compliance CSID Issued. Request ID: ${complianceRequestId}`);
    
    // Verify Certificate Utility
    if (egs.get().compliance_certificate) {
       console.log(`[Cert] Is PEM formatted: ${isPemCertificate(egs.get().compliance_certificate!)}`);
    }

    console.log(`[API] Requesting Production CSID using Compliance Request ID...`);
    const productionRequestId = await egs.issueProductionCertificate(complianceRequestId);
    console.log(`[API] Production CSID Issued. Request ID: ${productionRequestId}\\n`);


    // ------------------------------------------------------------------------------
    // INVOICE CREATION
    // ------------------------------------------------------------------------------
    console.log("--- Phase 3: Invoice Creation ---");
    
    // Determine timestamps
    const issueDate = "2024-05-18"; // Format: YYYY-MM-DD
    const issueTime = "14:30:00"; // Format: HH:mm:ss

    console.log(`[Invoice] Building Standard Tax Invoice (B2B)...`);
    const standardInvoice = new ZATCAInvoice({
      props: {
        egs_info: egs.get(),
        invoice_counter_number: 1, // ICV
        invoice_serial_number: "INV-2024-0001", // Sequential ID
        invoice_type: ZATCAInvoiceTypes.INVOICE,
        invoice_code: "0100000", // Standard Tax Invoice (B2B)
        issue_date: issueDate,
        issue_time: issueTime,
        previous_invoice_hash: ZATCA_CONSTANTS.FIRST_INVOICE_PREVIOUS_HASH, // PIH
        line_items: sampleLineItems,
        actual_delivery_date: issueDate,
        payment_method: ZATCAPaymentMethods.BANK_ACCOUNT,
      },
      acceptWarning: true,
    });
    console.log(`[Invoice] Standard Tax Invoice Built Successfully.`);

    console.log(`[Invoice] Building Simplified Tax Invoice (B2C)...`);
    const simplifiedInvoice = new ZATCAInvoice({
      props: {
        egs_info: egs.get(),
        invoice_counter_number: 2, // ICV
        invoice_serial_number: "SIM-2024-0002", // Sequential ID
        invoice_type: ZATCAInvoiceTypes.INVOICE,
        invoice_code: "0200000", // Simplified Tax Invoice (B2C)
        issue_date: issueDate,
        issue_time: issueTime,
        previous_invoice_hash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==", // Assume PIH from first invoice
        line_items: sampleLineItems,
      },
      acceptWarning: true, // Auto-correct minor rounding issues
    });
    console.log(`[Invoice] Simplified Tax Invoice Built Successfully.\\n`);


    // ------------------------------------------------------------------------------
    // DIGITAL SIGNING & QR GENERATION
    // ------------------------------------------------------------------------------
    console.log("--- Phase 4: Invoice Cryptographic Signing ---");
    
    // We sign using the compliance certificate because ZATCA Sandbox environment
    // requires compliance certs for API validations. In true production,
    // we would set 'production' boolean to true.
    const isProductionSigning = false; 
    const signingTimestamp = `${issueDate}T${issueTime}Z`; // Standard ISO format

    console.log(`[Signer] Signing Standard Invoice...`);
    const standardSigned = egs.signInvoice(standardInvoice, isProductionSigning, signingTimestamp);
    console.log(`[Signer] Standard Invoice Hash: ${standardSigned.invoice_hash}`);
    
    console.log(`[Signer] Signing Simplified Invoice...`);
    const simplifiedSigned = egs.signInvoice(simplifiedInvoice, isProductionSigning, signingTimestamp);
    console.log(`[Signer] Simplified Invoice Hash: ${simplifiedSigned.invoice_hash}`);
    
    // We can also generate Phase 1 QR manually if needed (Utility demo)
    const phaseOneQR = generatePhaseOneQR({ invoice_xml: standardInvoice.getXML() });
    console.log(`[Signer] Phase 1 Legacy QR Length: ${phaseOneQR.length}\\n`);

    
    // ------------------------------------------------------------------------------
    // ZATCA API REPORTING / CLEARANCE / COMPLIANCE
    // ------------------------------------------------------------------------------
    console.log("--- Phase 5: ZATCA API Integration ---");

    // 1. Compliance Check
    console.log(`[API] Validating Standard Invoice Compliance...`);
    try {
      const complianceResponse = await egs.checkInvoiceCompliance(
        standardSigned.signed_invoice_string, 
        standardSigned.invoice_hash
      );
      console.log(`[API] Compliance Status: ${complianceResponse.validationResults?.status || 'Unknown'}`);
    } catch (e: any) {
      console.warn(`[API] Compliance Error: ${e.message}`);
    }
    
    // 2. Clearance (For Standard B2B Invoices)
    console.log(`[API] Clearing Standard Invoice...`);
    try {
        const clearanceResponse = await egs.clearanceInvoice(
            standardSigned.signed_invoice_string,
            standardSigned.invoice_hash
        );
        console.log(`[API] Clearance Status: ${clearanceResponse.validationResults?.status || 'Unknown'}`);
    } catch (e: any) {
        console.warn(`[API] Clearance Note: In Sandbox, Clearance might fail depending on cert state. Msg: ${e.message}`);
    }

    // 3. Reporting (For Simplified B2C Invoices)
    console.log(`[API] Reporting Simplified Invoice...`);
    try {
        const reportResponse = await egs.reportInvoice(
        simplifiedSigned.signed_invoice_string, 
        simplifiedSigned.invoice_hash
        );
        console.log(`[API] Report Status: ${reportResponse.validationResults?.status || 'Unknown'}`);
    } catch (e: any) {
         console.warn(`[API] Reporting Note: Msg: ${e.message}`);
    }

    // ------------------------------------------------------------------------------
    // ONBOARDING FLOW: CERTIFICATE RENEWAL (Optional)
    // ------------------------------------------------------------------------------
    console.log("\\n--- Phase 6: Certificate Renewal Demonstration ---");
    console.log("[API] Requesting CSID Renewal (generating new CSR)...");
    
    try {
      // Generate a fresh CSR for renewal
      await egs.generateNewKeysAndCSR(true, "PioneerSoft-ERP");
      const RENEWAL_OTP = "123345"; // For Sandbox testing
      
      const renewalRequestId = await egs.renewProductionCertificate(RENEWAL_OTP);
      console.log(`[API] CSID Renewal Successful. Request ID: ${renewalRequestId}`);
    } catch (e: any) {
      console.warn(`[API] Renewal Error: ${e.message}`);
    }

    console.log("\\n==============================================================================");
    console.log("✅ End-to-End Demonstration Completed Successfully!");
    console.log("==============================================================================");

  } catch (error: any) {
    console.error("\\n❌ ZATCA Process Error Encountered:");
    console.error(error?.message ?? error);
    if (error?.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
};

// Execute the main demonstration
main();