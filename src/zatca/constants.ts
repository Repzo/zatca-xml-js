export const ZATCA_CONSTANTS = {
    // Currency
    CURRENCY_CODE: 'SAR',
    CURRENCY_NAME: 'Saudi Riyal',

    // Country
    COUNTRY_CODE: 'SA',
    COUNTRY_NAME: 'Saudi Arabia',

    // VAT Categories (UN/CEFACT code list 5305)
    VAT_CATEGORY_STANDARD: 'S', // Standard rated (15%)
    VAT_CATEGORY_ZERO: 'Z', // Zero rated (0%)
    VAT_CATEGORY_EXEMPT: 'E', // Exempt from tax
    VAT_CATEGORY_NOT_SUBJECT: 'O', // Not subject to VAT
    VAT_CATEGORY_CODE: 'S', // Default: Standard rated
    VAT_RATE: 15.0, // 15% VAT in Saudi Arabia

    // Payment Means Codes
    PAYMENT_MEANS: {
        CASH: '10',
        CARD: '48',
        BANK_TRANSFER: '42',
        CREDIT: '30',
        OTHER: '1',
    },

    // previous hash for the first invoice
    FIRST_INVOICE_PREVIOUS_HASH:
        'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',

    // API Endpoints
    API: {
        SANDBOX_BASE_URL: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
        PRODUCTION_BASE_URL: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
        SIMULATION_BASE_URL: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",

        // Compliance (onboarding)
        COMPLIANCE_CSID: '/compliance',
        COMPLIANCE_INVOICE_CHECK: '/compliance/invoices',

        // Production
        PRODUCTION_CSID: '/production/csids',
        REPORT_INVOICE: '/invoices/reporting/single',
        CLEAR_INVOICE: '/invoices/clearance/single',
    },

    NOTE_REASONS: {
        CREDIT_NOTE: 'In case of goods or services refund | عند ترجيع السلع أو الخدمات',
        DEBIT_NOTE: 'Additional charges applied after invoice issuance | تمت إضافة رسوم إضافية بعد إصدار الفاتورة',
    },
} as const;
