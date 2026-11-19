import { NextResponse } from "next/server";

/**
 * MTA-STS policy (RFC 8461), fetched by sending mail servers from
 * https://mta-sts.<domain>/.well-known/mta-sts.txt. It tells them mail for
 * this domain must only be delivered over verified TLS to the listed MX
 * hosts (Zoho Mail), which blocks downgrade and MX-spoofing attacks on
 * incoming email.
 *
 * The policy is only consulted when the domain publishes a matching
 * `_mta-sts` TXT record (and `_smtp._tls` for TLS-RPT failure reports) —
 * see docs/email-security.md. Rollout: "testing" first (failures are
 * reported but mail still flows), then "enforce" once reports are clean.
 * Bump the TXT record's id whenever this text changes.
 */
const MTA_STS_MODE: "testing" | "enforce" = "testing";
const MTA_STS_MX = ["mx.zoho.com", "mx2.zoho.com", "mx3.zoho.com"];

export function GET() {
  const body = [
    "version: STSv1",
    `mode: ${MTA_STS_MODE}`,
    ...MTA_STS_MX.map((mx) => `mx: ${mx}`),
    "max_age: 604800",
  ].join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
