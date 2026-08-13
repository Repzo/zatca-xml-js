import axios from "axios";
import { certificateToBinarySecurityToken, rawTokenToPem } from "../certificate";
import { ZATCA_CONSTANTS } from "../constants";

const settings = {
  API_VERSION: "V2",
  SANDBOX_BASEURL: ZATCA_CONSTANTS.API.SANDBOX_BASE_URL,
  SIMULATION_BASEURL: ZATCA_CONSTANTS.API.SIMULATION_BASE_URL,
  PRODUCTION_BASEURL: ZATCA_CONSTANTS.API.PRODUCTION_BASE_URL,
};
const HTTP_TIMEOUT_MS = 30_000;


interface ComplianceAPIInterface {
  /**
   * Requests a new compliance certificate and secret.
   * @param csr String CSR
   * @param otp String Tax payer provided OTP from Fatoora portal
   * @returns issued_certificate: string, api_secret: string, or throws on error.
   */
  issueCertificate: (csr: string, otp: string) => Promise<{ issued_certificate: string, api_secret: string, request_id: string }>

  /**
  * Checks compliance of a signed ZATCA XML.
  * @param signed_xml_string String.
  * @param invoice_hash String.
  * @param egs_uuid String.
  * @returns Any status.
  */
  checkInvoiceCompliance: (signed_xml_string: string, invoice_hash: string, egs_uuid: string) => Promise<any>
}


interface ProductionAPIInterface {
  /**
   * Requests a new production certificate and secret.
   * @param compliance_request_id String compliance_request_id
   * @returns issued_certificate: string, api_secret: string, or throws on error.
   */
  issueCertificate: (compliance_request_id: string) => Promise<{ issued_certificate: string, api_secret: string, request_id: string }>
  /**
   * Starts production certificate renewal by submitting a fresh CSR while
   * authenticating with the currently active production CSID.
   * @param csr String CSR in PEM format.
   * @param otp String renewal OTP from the Fatoora portal.
   * @param current_ccsid Optional current CSID raw token. Defaults to the authenticated certificate.
   * @returns issued_certificate: string, api_secret: string, request_id: string
   */
  renewCertificate: (csr: string, otp: string, current_ccsid?: string) => Promise<{ issued_certificate: string, api_secret: string, request_id: string }>

  /**
  * Report signed ZATCA XML.
  * @param signed_xml_string String.
  * @param invoice_hash String.
  * @param egs_uuid String.
  * @returns Any status.
  */
  reportInvoice: (signed_xml_string: string, invoice_hash: string, egs_uuid: string) => Promise<any>
  /**
  * Report signed ZATCA XML.
  * @param signed_xml_string String.
  * @param invoice_hash String.
  * @param egs_uuid String.
  * @returns Any status.
  */
  clearanceInvoice: (signed_xml_string: string, invoice_hash: string, egs_uuid: string) => Promise<any>;
}


class API {
  private env: string;

  constructor(env: "production" | "simulation" | "development") {
    this.env = env;
  }


  private getAuthHeaders = (certificate?: string, secret?: string): any => {
    if (certificate && secret) {

      const basic = Buffer.from(`${certificateToBinarySecurityToken(certificate)}:${secret}`).toString("base64");
      return {
        "Authorization": `Basic ${basic}`
      };
    }
    return {};
  }

  compliance(certificate?: string, secret?: string): ComplianceAPIInterface {
    const auth_headers = this.getAuthHeaders(certificate, secret);
    const base_url =
      this.env == "production"
        ? settings.PRODUCTION_BASEURL
        : this.env == "simulation"
          ? settings.SIMULATION_BASEURL
          : settings.SANDBOX_BASEURL;

    const issueCertificate = async (csr: string, otp: string): Promise<{ issued_certificate: string, api_secret: string, request_id: string }> => {
      const headers = {
        "Accept-Version": settings.API_VERSION,
        OTP: otp
      };

      const response = await axios.post(`${base_url}/compliance`,
        { csr: Buffer.from(csr).toString("base64") },
        { headers: { ...auth_headers, ...headers }, timeout: HTTP_TIMEOUT_MS }
      );

      if (response.status != 200) throw new Error("Error issuing a compliance certificate.");

      const issued_certificate = rawTokenToPem(response.data.binarySecurityToken);
      const api_secret = response.data.secret;

      return { issued_certificate, api_secret, request_id: response.data.requestID };
    }

    const checkInvoiceCompliance = async (signed_xml_string: string, invoice_hash: string, egs_uuid: string): Promise<any> => {
      const headers = {
        "Accept-Version": settings.API_VERSION,
        "Accept-Language": "en",
      };

      const response = await axios.post(`${base_url}/compliance/invoices`,
        {
          invoiceHash: invoice_hash,
          uuid: egs_uuid,
          invoice: Buffer.from(signed_xml_string).toString("base64")
        },
        { headers: { ...auth_headers, ...headers }, timeout: HTTP_TIMEOUT_MS }
      );

      if (response.status != 200 && response.status != 202) throw new Error("Error in compliance check.");
      return response.data;
    }

    return {
      issueCertificate,
      checkInvoiceCompliance
    }
  }


  production(certificate?: string, secret?: string): ProductionAPIInterface {
    const auth_headers = this.getAuthHeaders(certificate, secret);
    const base_url =
      this.env == "production"
        ? settings.PRODUCTION_BASEURL
        : this.env == "simulation"
          ? settings.SIMULATION_BASEURL
          : settings.SANDBOX_BASEURL;

    const issueCertificate = async (compliance_request_id: string): Promise<{ issued_certificate: string, api_secret: string, request_id: string }> => {
      const headers = {
        "Accept-Version": settings.API_VERSION
      };

      const response = await axios.post(`${base_url}/production/csids`,
        { compliance_request_id: compliance_request_id },
        { headers: { ...auth_headers, ...headers }, timeout: HTTP_TIMEOUT_MS }
      );

      if (response.status != 200) throw new Error("Error issuing a production certificate.");

      const issued_certificate = rawTokenToPem(response.data.binarySecurityToken);
      const api_secret = response.data.secret;

      return { issued_certificate, api_secret, request_id: response.data.requestID };
    }

    const renewCertificate = async (
      csr: string,
      otp: string,
      current_ccsid?: string
    ): Promise<{ issued_certificate: string, api_secret: string, request_id: string }> => {
      if (!certificate || !secret) {
        throw new Error("Certificate and secret are required to renew a production CSID.");
      }

      const headers = {
        "Accept-Version": settings.API_VERSION,
        "OTP": otp,
        "CurrentCCSID": current_ccsid || certificateToBinarySecurityToken(certificate),
      };

      const response = await axios.patch(
        `${base_url}/production/csids`,
        { csr: Buffer.from(csr).toString("base64") },
        { headers: { ...auth_headers, ...headers }, timeout: HTTP_TIMEOUT_MS }
      );

      if (response.status != 200) throw new Error("Error renewing a production certificate.");

      const issued_certificate = rawTokenToPem(response.data.binarySecurityToken);
      const api_secret = response.data.secret;

      return { issued_certificate, api_secret, request_id: response.data.requestID };
    }

    const reportInvoice = async (signed_xml_string: string, invoice_hash: string, egs_uuid: string): Promise<any> => {
      try {
        const headers = {
          "Accept-Version": settings.API_VERSION,
          "Accept-Language": "en",
          "Clearance-Status": "0"
        };

        const response = await axios.post(
          `${base_url}/invoices/reporting/single`,
          {
            invoiceHash: invoice_hash,
            uuid: egs_uuid,
            invoice: Buffer.from(signed_xml_string).toString("base64"),
          },
          { headers: { ...auth_headers, ...headers }, timeout: HTTP_TIMEOUT_MS }
        );

        if (response.status != 200 && response.status !== 202)
          throw new Error("Error in reporting invoice.");
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 400) {
          const responseData = error.response.data;
          if (responseData?.reportingStatus) return responseData;
        }
        throw error;
      }
    };

    const clearanceInvoice = async (
      signed_xml_string: string,
      invoice_hash: string,
      egs_uuid: string
    ): Promise<any> => {
      try {
        const headers = {
          "Accept-Version": settings.API_VERSION,
          "Accept-Language": "en",
          "Clearance-Status": "1",
        };

        const response = await axios.post(`${base_url}/invoices/clearance/single`,
          {
            invoiceHash: invoice_hash,
            uuid: egs_uuid,
            invoice: Buffer.from(signed_xml_string).toString("base64"),
          },
          { headers: { ...auth_headers, ...headers }, timeout: HTTP_TIMEOUT_MS }
        );

        if (response.status != 200 && response.status !== 202)
          throw new Error("Error in clearance invoice.");
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 400) {
          const responseData = error.response.data;
          if (responseData?.reportingStatus) return responseData;
        }
        throw error;
      }
    };
    return {
      issueCertificate,
      renewCertificate,
      reportInvoice,
      clearanceInvoice,
    };
  }
}

export default API;
