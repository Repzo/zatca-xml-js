# Security Policy

## Supported versions

Security fixes are prioritized for the latest published `0.1.x` release line
and the current default development branch.

## Reporting a vulnerability

This library handles security-sensitive material, including:

- Private keys used for invoice signing
- Compliance and production CSIDs
- API secrets
- OTP-based onboarding flows
- Signed XML documents and certificate material

Please do not open a public issue for security reports.

Do not post any of the following in public issues, pull requests, or discussion
threads:

- Private keys or CSR contents from real environments
- Production CSIDs, API secrets, or OTP codes
- Real certificates or certificate chains
- Full signed production invoices containing personal, customer, or VAT data
- Detailed exploit instructions before maintainers have had time to respond

Use one of these private reporting paths instead:

- GitHub Security Advisories for this repository, if enabled
- A private maintainer security contact channel published by the repository
  owner

Include the affected version, impact, reproduction steps, and any suggested
mitigation when possible.

## Response timeline

Maintainers aim to acknowledge security reports within 7 business days and will
share follow-up steps after triage.

## Scope

This policy covers vulnerabilities in this library's cryptographic handling,
certificate utilities, CSR processing, invoice signing, XML generation, QR
generation, and ZATCA API request/response handling.

This policy does not cover:

- ZATCA platform outages or sandbox instability
- Misconfiguration in downstream applications using this package
- Security issues in third-party infrastructure not controlled by this project
