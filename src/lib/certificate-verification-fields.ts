/** The fields hashed into a certificate's content hash (see
 * canonicalCertificatePayload), in canonical order. Kept free of server
 * imports so the client verification view can list them. */
export const CERTIFICATE_SEALED_FIELDS = [
  "category (capacity)",
  "ISSN",
  "issue date and time",
  "issuing publisher",
  "recipient name",
  "serial number",
  "certificate type",
  "work title (authors)",
] as const;
