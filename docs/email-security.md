# Email security (SPF, DKIM, DMARC, MTA-STS, TLS-RPT)

DNS for eleventhpress.com is hosted on Vercel DNS. Mail flows:

- **Inbound + staff mail:** Zoho Mail (MX `mx.zoho.com`, `mx2.zoho.com`, `mx3.zoho.com`).
- **Website's automatic emails:** Resend, sending from the `send.` subdomain.

| Record | Name | Value | Purpose |
|---|---|---|---|
| TXT | `@` | `v=spf1 include:zohomail.com ~all` | SPF for Zoho-sent mail (Resend uses its own `send.` subdomain return-path) |
| TXT | `zmail._domainkey` | Zoho DKIM key | DKIM for Zoho |
| TXT | `resend._domainkey` | Resend DKIM key | DKIM for Resend (aligned to the root domain) |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; pct=100` | Fail-closed DMARC |
| TXT | `_mta-sts` | `v=STSv1; id=<yyyymmdd>` | Announces the MTA-STS policy |
| TXT | `_smtp._tls` | `v=TLSRPTv1; rua=mailto:editorial@eleventhpress.com` | Daily TLS failure reports |

## MTA-STS

The policy is served by the app at `/.well-known/mta-sts.txt`
(`src/app/.well-known/mta-sts.txt/route.ts`) and reached as
`https://mta-sts.eleventhpress.com/.well-known/mta-sts.txt` through the
project's `*.eleventhpress.com` wildcard domain.

Rollout:
1. `mode: testing` (current). Reports arrive at the TLS-RPT address; mail is never blocked.
2. After ~2 weeks of clean reports, change the route to `mode: enforce`
   and bump the `_mta-sts` TXT `id`.
3. If the MX hosts ever change, update `MTA_STS_MX` in the route **and**
   bump the id **before** switching MX records.

## DMARC

Move `p=none` → `p=quarantine` → `p=reject` once every legitimate sender
(Zoho, Resend) is confirmed passing. Any new sending service must be added
to SPF or given aligned DKIM first, or its mail will be quarantined.
