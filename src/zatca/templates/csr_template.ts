// 2.2.2 Profile specification of the Cryptographic Stamp identifiers. & CSR field contents / RDNs.
const template = `
# ------------------------------------------------------------------
# Default section for "req" command options
# ------------------------------------------------------------------
oid_section=OIDS

[OIDS]
# Certificate template OID used by ZATCA.
certificateTemplateName= 1.3.6.1.4.1.311.20.2

[req]
# Password for reading in existing private key file
# input_password = SET_PRIVATE_KEY_PASS

# Key size and digest used to create the CSR.
default_bits=2048
# The email is optional and is populated from the existing ZATCA_EMAIL setting.
emailAddress=SET_EMAIL_ADDRESS
# Prompt for DN field values and CSR attributes in ASCII
prompt = no
utf8 = no
# Section pointer for DN field options
default_md=sha256
# Extensions
req_extensions=req_ext
distinguished_name=dn

[dn]
# ------------------------------------------------------------------
# Section for prompting DN field values to create "subject"
# ------------------------------------------------------------------
# Common name (EGS TaxPayer PROVIDED ID [FREE TEXT])
CN=SET_COMMON_NAME
# ISO2 country code is required with US as default
C=SA
# Organization Unit (Branch name)
OU=SET_BRANCH_NAME
# Organization name (Tax payer name)
O=SET_TAXPAYER_NAME

[v3_req]
# Basic constraints and key usage required by the legacy backend CSR profile.
#basicConstraints=CA:FALSE
#keyUsage = digitalSignature, keyEncipherment
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment

[req_ext]
# Production or Testing Template (TSTZATCA-Code-Signing - ZATCA-Code-Signing)
certificateTemplateName = ASN1:PRINTABLESTRING:SET_PRODUCTION_VALUE
subjectAltName = dirName:alt_names

[alt_names]
# EGS Serial number (1-SolutionName|2-ModelOrVersion|3-serialNumber)
SN = SET_EGS_SERIAL_NUMBER
# VAT Registration number of TaxPayer (Organization identifier [15 digits begins with 3 and ends with 3])
UID = SET_VAT_REGISTRATION_NUMBER
# Invoice type (TSCZ)(1 = supported, 0 not supported) (Tax, Simplified, future use, future use)
title = SET_INVOICE_TYPE
# Location (branch address or website)
registeredAddress = SET_BRANCH_LOCATION
# Industry (industry sector name)
businessCategory = SET_BRANCH_INDUSTRY

# The values above are populated by defaultCSRConfig before OpenSSL runs.
`;


interface CSRConfigProps {
    private_key_pass?: string,
    production?: boolean,
    egs_model: string,
    egs_serial_number: string,
    solution_name: string,
    vat_number: string,
    branch_location: string,
    branch_industry: string,
    branch_name: string,
    taxpayer_name: string,
    taxpayer_provided_id: string,
    invoice_type?: string,
    email_address?: string

}
export default function populate(props: CSRConfigProps): string {
    let populated_template = template;
    populated_template = populated_template.replace("SET_PRIVATE_KEY_PASS", props.private_key_pass ?? "SET_PRIVATE_KEY_PASS");
    populated_template = populated_template.replace("SET_EMAIL_ADDRESS", props.email_address ?? "");
    populated_template = populated_template.replace("SET_PRODUCTION_VALUE", props.production ? "ZATCA-Code-Signing" : "PREZATCA-Code-Signing");
    populated_template = populated_template.replace("SET_EGS_SERIAL_NUMBER", `1-${props.solution_name}|2-${props.egs_model}|3-${props.egs_serial_number}`);
    populated_template = populated_template.replace("SET_VAT_REGISTRATION_NUMBER", props.vat_number);
    populated_template = populated_template.replace("SET_BRANCH_LOCATION", props.branch_location);
    populated_template = populated_template.replace("SET_BRANCH_INDUSTRY", props.branch_industry);
    populated_template = populated_template.replace("SET_INVOICE_TYPE", props.invoice_type ?? "1100");
    populated_template = populated_template.replace("SET_COMMON_NAME", props.taxpayer_provided_id);
    populated_template = populated_template.replace("SET_BRANCH_NAME", props.branch_name);
    populated_template = populated_template.replace("SET_TAXPAYER_NAME", props.taxpayer_name);

    return populated_template;
};
