import { createPublicKey } from "crypto";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export class ZATCACryptoExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZATCACryptoExecutionError";
  }
}

const runOpenSSL = (args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const command = spawn("openssl", args);
    let stdout = "";
    let stderr = "";

    command.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    command.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    command.on("close", (code) => {
      if (code !== 0) {
        reject(new ZATCACryptoExecutionError(`OpenSSL failed with exit code ${code}: ${stderr}`));
        return;
      }

      resolve(stdout || stderr);
    });

    command.on("error", (error) => {
      reject(new ZATCACryptoExecutionError(`OpenSSL execution failed: ${error.message}`));
    });
  });
};

const withTempFile = async <T>(extension: string, contents: string, cb: (file: string) => Promise<T>): Promise<T> => {
  const file = path.join(process.env.TEMP_FOLDER || os.tmpdir(), `${uuidv4()}.${extension}`);
  fs.writeFileSync(file, contents);

  try {
    return await cb(file);
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
};

export const extractPublicKey = (privateKeyPem: string): string => {
  try {
    return createPublicKey(privateKeyPem)
      .export({ type: "spki", format: "pem" })
      .toString()
      .trim();
  } catch (error: any) {
    throw new ZATCACryptoExecutionError(`Failed to extract public key: ${error.message}`);
  }
};

export const verifyCsr = async (csrPem: string): Promise<boolean> => {
  try {
    const output = await withTempFile("csr", csrPem, (csrFile) =>
      runOpenSSL(["req", "-text", "-noout", "-verify", "-in", csrFile])
    );
    return output.includes("verify OK");
  } catch {
    return false;
  }
};

export const extractCsrInfo = async (
  csrPem: string
): Promise<{
  subject: string;
  publicKeyAlgorithm: string;
  signatureAlgorithm: string;
}> => {
  const output = await withTempFile("csr", csrPem, (csrFile) =>
    runOpenSSL(["req", "-text", "-noout", "-in", csrFile])
  );

  const subjectMatch = output.match(/Subject: (.+)/);
  const publicKeyMatch = output.match(/Public Key Algorithm: (.+)/);
  const signatureMatch = output.match(/Signature Algorithm: (.+)/);

  return {
    subject: subjectMatch ? subjectMatch[1].trim() : "Unknown",
    publicKeyAlgorithm: publicKeyMatch ? publicKeyMatch[1].trim() : "Unknown",
    signatureAlgorithm: signatureMatch ? signatureMatch[1].trim() : "Unknown",
  };
};
