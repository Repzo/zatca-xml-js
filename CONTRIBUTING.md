# Contributing

Thank you for your interest in improving `@pioneersoft/zatca-einvoice`.

This project is a TypeScript/npm library for Saudi Arabia ZATCA Phase 2
e-invoicing workflows, including onboarding, invoice XML generation, signing,
QR generation, and API integrations. Contributions are welcome across code,
documentation, examples, tests, and issue triage.

## Ways to contribute

- Report bugs with a minimal reproducible example
- Suggest API improvements or missing ZATCA workflow support
- Improve documentation and examples
- Add focused tests for stable library behavior
- Fix bugs or cleanup maintainability issues

## Development setup

```bash
git clone https://github.com/PioneerSoft-sa/zatca-einvoice.git
cd zatca-einvoice
npm install
npm run build
npm run example
```

`npm run example` exercises an end-to-end demo and may require OpenSSL plus
valid sandbox behavior, so it is optional for documentation-only changes.

## OpenSSL requirement

This library uses the OpenSSL CLI for secp256k1 key generation and CSR-related
operations. Make sure OpenSSL is installed and available on your `PATH` before
testing onboarding or renewal flows.

## Branch naming

Use short, descriptive branch names when possible:

- `feature/<short-description>`
- `fix/<short-description>`
- `docs/<short-description>`

If an issue already exists, link the pull request to it.

## Before opening a pull request

- Run `npm run build`
- Run `npm run lint` if you are touching formatting-sensitive files
- Update `README.md` or related docs if behavior changes
- Make sure no secrets, `.env` files, private keys, CSIDs, certificates, or
  API credentials are included in the diff

## Pull request target

Open pull requests against the repository's default development branch. If your
hosting configuration uses `main`, prefer that unless maintainers document a
different target branch.

## Code style

- Match the existing TypeScript conventions under `src/`
- Keep changes focused and minimal in scope
- Preserve public API behavior unless a change is intentional and documented
- Prefer targeted additions over broad refactors

## Security-sensitive contributions

Please avoid posting private keys, CSIDs, API secrets, OTPs, real certificates,
or production invoice data in issues or pull requests. If you believe you found
a vulnerability in the crypto, XML, or API handling, follow the private
reporting instructions in [SECURITY.md](SECURITY.md).
