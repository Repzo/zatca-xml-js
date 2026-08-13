export class ZATCACertificateFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZATCACertificateFormatError";
  }
}

const CERT_BEGIN = "-----BEGIN CERTIFICATE-----";
const CERT_END = "-----END CERTIFICATE-----";

const normalizeLineEndings = (value: string): string => value.replace(/\r\n/g, "\n").trim();

export const isPemCertificate = (certificate: string): boolean => {
  const normalized = normalizeLineEndings(certificate);
  return normalized.includes(CERT_BEGIN) && normalized.includes(CERT_END);
};

export const getCertificateBody = (certificate: string): string => {
  const normalized = normalizeLineEndings(certificate);

  if (isPemCertificate(normalized)) {
    return normalized
      .replace(CERT_BEGIN, "")
      .replace(CERT_END, "")
      .replace(/\s/g, "")
      .trim();
  }

  return normalized.replace(/\s/g, "");
};

export const rawTokenToPem = (binarySecurityToken: string): string => {
  if (isPemCertificate(binarySecurityToken)) return normalizeCertificatePem(binarySecurityToken);

  const rawToken = binarySecurityToken.replace(/\s/g, "");
  const decoded = Buffer.from(rawToken, "base64").toString("utf8").trim();

  if (isPemCertificate(decoded)) return normalizeCertificatePem(decoded);

  if (!/^[A-Za-z0-9+/=]+$/.test(decoded.replace(/\s/g, ""))) {
    throw new ZATCACertificateFormatError("Invalid ZATCA binarySecurityToken certificate data.");
  }

  return `${CERT_BEGIN}\n${decoded.replace(/\s/g, "")}\n${CERT_END}`;
};

export const normalizeCertificatePem = (certificate: string): string => {
  if (!isPemCertificate(certificate)) return rawTokenToPem(certificate);
  return `${CERT_BEGIN}\n${getCertificateBody(certificate)}\n${CERT_END}`;
};

export const certificateToBinarySecurityToken = (certificate: string): string => {
  if (!certificate) throw new ZATCACertificateFormatError("Certificate value is required.");

  if (!isPemCertificate(certificate)) {
    return certificate.replace(/\s/g, "");
  }

  return Buffer.from(getCertificateBody(certificate)).toString("base64");
};
