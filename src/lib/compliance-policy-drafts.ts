import type { PolicyCategory } from "./compliance";

/**
 * Starting texts for the Compliance Register's Policy Library.
 *
 * Every text is a DRAFT for the owner to read, change and adopt. Rules for
 * writing and editing them:
 *  - "How it works today" states only what exists in this codebase or its
 *    documented set-up. Nothing aspirational goes in that section.
 *  - "Rules" are commitments the owner takes on by adopting the policy.
 *    Where a rule depends on something still being built, it says when.
 *  - Anything we cannot verify from the repository is written as a
 *    [CONFIRM: …] note. The register refuses to adopt a policy until every
 *    note has been replaced by a true statement or removed.
 *  - Texts are internal. The public Trust page shows only titles and dates.
 *
 * `covers` lists the CAIQ / AI-CAIQ question IDs whose answer relies on the
 * document (policy exists, is reviewed yearly, or both). It feeds the yearly
 * STAR refresh.
 */

export interface PolicyDraft {
  slug: string;
  title: string;
  category: PolicyCategory;
  covers: string;
  body: string;
}

const REVIEW = `
## Review
This document is reviewed at least once every 12 months, and sooner after any significant change to the platform, its suppliers or the law. Each review is recorded with its date in the Compliance Register.`;

export const POLICY_DRAFTS: PolicyDraft[] = [
  {
    slug: "information-security",
    title: "Information Security and Governance Policy",
    category: "GOVERNANCE",
    covers: "GRC-01.2 GRC-03.1 GRC-07.2",
    body: `# Information Security and Governance Policy

## Purpose
To protect the confidentiality, integrity and availability of the data entrusted to the platform: manuscripts, reviews, author and reader accounts, and the data of white-label portals.

## Scope
The Eleventh Press platform, its hosting and supplier services, and every person (owner, employee, contractor, volunteer) who works on it.

## How it works today
- The platform owner is the sponsor of this programme and holds the SUPER_ADMIN role.
- Roles are defined in the product: reader, author, reviewer, associate editor, editor, expert, tenant administrator and super administrator. Each API route checks role and ownership.
- A summary of security, privacy, accessibility and AI practice is published on the Trust page.
- Applicable requirements we track: GDPR and UK GDPR, the Philippine Data Privacy Act (RA 10173), CCPA/CPRA, EU AI Act Article 50, and the COPE and ICMJE publication ethics standards.

## Rules
1. The owner approves every security and privacy policy before it takes effect. Approved policies are kept in the Compliance Register.
2. The legal and contractual requirements above are re-checked at least once a year, and when the platform starts working in a new country or with a new kind of data.
3. Every policy has a named owner, a version and a next review date in the Compliance Register.
4. Deviations from a policy follow the Policy Exception Process.
5. Security questions from customers and the public are answered through the Trust page and the security.txt contact.
${REVIEW}`,
  },
  {
    slug: "access-control",
    title: "Access Control and Authentication Policy",
    category: "SECURITY",
    covers: "IAM-01.2 IAM-02.2 IAM-08.1 IAM-10.1 IAM-10.2",
    body: `# Access Control and Authentication Policy

## Purpose
To make sure people can reach only the data and functions their role needs.

## How it works today
- Access is role-based and enforced in code on every API route, with ownership checks so users see only their own records.
- Passwords are stored only as bcrypt hashes; the minimum length is 8 characters.
- After 5 failed sign-ins an account locks for 15 minutes, rising with repeated failures to a maximum of 60 minutes.
- Two-step sign-in with an authenticator app (TOTP), emailed codes and passkeys (WebAuthn) is available to every account, and is mandatory for super administrators, editors, associate editors and tenant administrators before the dashboard opens.
- Sessions are signed, HTTP-only cookies that last 7 days, and a person can sign out other devices from their profile.
- Role changes are made only by an administrator and are written to the audit log.
- White-label portals administer their own staff accounts and cannot see other portals' data.

## Rules
1. Staff and contractors receive the lowest role that lets them do their work, and only after the owner approves.
2. Super administrator, editor, associate editor and tenant administrator accounts must use two-step sign-in. The dashboard blocks these roles behind a setup screen until it is on. The block is applied in the dashboard interface; it is not yet enforced for direct API use, which is a known limit.
3. Shared accounts are not allowed. Every person has their own account.
4. Access is removed on the day someone stops working on the platform.
5. Elevated roles (super administrator, editor, associate editor, tenant administrator) are reviewed at least once a year. The review is recorded in the Compliance Register. The first one is due by January 2027.
6. Elevated roles given for a short job are given for a set period and removed when it ends.
${REVIEW}`,
  },
  {
    slug: "cryptography-and-keys",
    title: "Cryptography and Key Management Policy",
    category: "SECURITY",
    covers: "CEK-01.1 CEK-01.2 CEK-09.2 CEK-12.1 CEK-14.1 CEK-15.1 CEK-16.1 CEK-17.1 CEK-18.1 CEK-19.1 CEK-20.1 CEK-21.1",
    body: `# Cryptography and Key Management Policy

## Purpose
To protect data in transit and at rest with standard, well-reviewed cryptography, and to manage the secrets behind it safely.

## How it works today
- All traffic uses TLS (1.2 or higher) with HSTS preload. Certificates are issued and renewed automatically by the hosting provider.
- Sensitive fields (for example encrypted integration tokens) are encrypted at rest with AES-256-GCM.
- Passwords use bcrypt. Sessions use signed JSON web tokens.
- Keys and secrets are generated with a cryptographically secure random generator (32 random bytes) and stored as environment variables in the hosting dashboard. They are never committed to the code repository. Gitleaks scans every change for committed secrets.
- Separate secrets are used for sessions and for field encryption.
- If a secret is exposed, the runbook says to rotate it and sign out all sessions.
- We use standard cryptographic modules but do not claim FIPS validation.

## Rules
1. Only industry-standard algorithms are used. Home-made cryptography is not allowed.
2. The owner keeps a Key Inventory in the Compliance Register: the name, purpose, where it is stored, who can read it, the date created and the next rotation date. The inventory never contains the secret itself.
3. Each secret is rotated at least once a year, immediately after any suspected exposure, and whenever someone with access leaves.
4. Field-encryption keys are rotated without losing data: the new key is added, data is re-encrypted, and only then the old key is retired. This capability is being built (target January 2027); until it exists, the field-encryption key is not rotated except after an exposure.
5. A key that is no longer needed is deleted from the hosting dashboard, and the deletion is recorded in the inventory.
6. Customers do not supply their own keys. The platform does not offer customer-managed keys.
${REVIEW}`,
  },
  {
    slug: "secure-development-and-change",
    title: "Secure Development and Change Management Policy",
    category: "SECURITY",
    covers: "AIS-01.1 AIS-01.2 AIS-08.2 CCC-01.2 CCC-06.2",
    body: `# Secure Development and Change Management Policy

## Purpose
To make sure every change to the platform is reviewed, tested and reversible.

## How it works today
- Every change is made on a branch, never directly on the main branch.
- Before release the change must pass type checking, linting, automated tests, a production build, an accessibility scan, and security scanning (Semgrep for code, Gitleaks for secrets).
- A change is merged to the main branch only after the owner's explicit approval. Merging deploys to production through the hosting provider.
- Dependencies are installed from a frozen lockfile; Dependabot proposes updates weekly; a software bill of materials (CycloneDX) is generated on every change.
- Security baselines (headers, Content-Security-Policy, build settings) live in version control and change only through this process. The reasoning for the Content-Security-Policy is recorded in the repository documentation.
- A previous known-good deployment can be promoted for rollback.
- Database changes run without data-loss flags, so a destructive change stops the deployment.
- Application security requirements follow OWASP ASVS Level 2 as an internal checklist.

## Rules
1. No change reaches production without passing the automated checks and the owner's approval.
2. Emergency fixes use the same branch and checks, with a faster approval, and a note of what was done and why.
3. The security baselines and this policy are reviewed at least once a year.
4. A change that must skip a rule follows the Policy Exception Process.
${REVIEW}`,
  },
  {
    slug: "vulnerability-and-malware",
    title: "Vulnerability and Malware Management Policy",
    category: "SECURITY",
    covers: "TVM-01.2 TVM-02.2",
    body: `# Vulnerability and Malware Management Policy

## Purpose
To find and fix weaknesses in the platform and its components, and to keep malicious files out.

## How it works today
- Semgrep, Gitleaks and Dependabot run on every change and weekly; a failing scan blocks release.
- Dependabot waits 7 days before accepting a brand-new release, as protection against compromised packages.
- Anyone can report a vulnerability through the contact published at /.well-known/security.txt.
- Uploaded files are checked for malware with VirusTotal when that service is enabled. [CONFIRM: is VirusTotal scanning switched on in production?]

## Rules
1. Vulnerabilities are ranked with CVSS and fixed within these targets from the day they are confirmed: critical 7 days, high 30 days, medium 90 days, low at the next convenient update.
2. A reported vulnerability is acknowledged within 3 working days.
3. A fix that cannot meet its target is recorded in the Risk Register with a reason and a new date.
4. This policy is reviewed at least once a year.
${REVIEW}`,
  },
  {
    slug: "logging-and-monitoring",
    title: "Logging and Monitoring Policy",
    category: "SECURITY",
    covers: "LOG-01.2 LOG-07.2 LOG-05.1 LOG-05.2 LOG-11.1 LOG-12.1",
    body: `# Logging and Monitoring Policy

## Purpose
To keep a trustworthy record of what happens on the platform, and to notice problems early.

## How it works today
- Privileged actions are written to an audit log with the user, action, entity, time and details. The product has no route to edit or delete audit records, and only privileged roles can read them.
- Application errors go to Sentry. [CONFIRM: is Sentry error monitoring switched on in production?] The hosting provider keeps runtime logs. Time comes from the provider's synchronised infrastructure.
- Health checks run continuously and are published on the public status page.
- Ordinary page views are not logged with personal details. Raw IP addresses attached to usage events are cleared after 90 days.

## Rules
1. Sign-in failures, role changes, exports of personal data, encryption failures and changes to keys are logged.
2. The owner is alerted by email when the audit trail shows unusual activity (many failed sign-ins, a new super administrator, or a very large export). This alerting is being built (target February 2027).
3. Logs never contain passwords, session tokens or full payment details.
4. The scope of what is logged is reviewed at least once a year and whenever the threat picture changes.
${REVIEW}`,
  },
  {
    slug: "incident-management",
    title: "Security Incident Management Policy",
    category: "SECURITY",
    covers: "SEF-01.2 SEF-02.2 SEF-10.2 SEF-05.1 SEF-09.1 SEF-09.2",
    body: `# Security Incident Management Policy

This policy adopts the Incident response and recovery runbook kept in the repository (docs/incident-response.md) and a public summary on the Trust page. The two are kept in step.

## Severity
- Severity 1: site down, data exposed or account takeover. Acknowledge within 1 hour.
- Severity 2: a major feature is broken (submission, payments, sign-in). Acknowledge within 4 hours.
- Severity 3: minor defect or slow service. Acknowledge within 2 working days.

## Steps
1. Detect and triage: record time, reporter and scope.
2. Contain: roll back the deployment, switch off the affected feature, sign out sessions, rotate exposed keys.
3. Notify: if personal data may be affected, tell the Philippine National Privacy Commission within 72 hours, the EU or UK supervisory authority within 72 hours where it applies, and affected people. For white-label portal data, also tell the portal's administrator.
4. Recover and verify sign-in, submission, article pages and PDFs.
5. Learn: publish a plain summary on the status page within 5 working days and file the follow-up fixes.

## Rules
1. Every incident is recorded in the Compliance Register with severity, times, cause and fix. An Incident Register is being built (target February 2027).
2. The points of contact in the runbook (regulators, hosting, database, owner) are checked at least once a year.
3. A tabletop exercise and a restore drill are run and recorded as the runbook says.
${REVIEW}`,
  },
  {
    slug: "continuity-and-recovery",
    title: "Business Continuity and Disaster Recovery Policy",
    category: "SECURITY",
    covers: "BCR-01.2 BCR-02.2 BCR-05.3 BCR-09.2 BCR-06.1 BCR-08.3 BCR-10.1",
    body: `# Business Continuity and Disaster Recovery Policy

## Purpose
To keep the platform available, and to bring it back quickly and correctly when something goes wrong.

## How it works today
- The platform runs on a serverless hosting platform with managed Postgres. The database provider takes backups and offers point-in-time recovery. [CONFIRM: are backups and point-in-time recovery switched on for the production database, and in which region is it? Replace with the plan name and region.]
- Recovery targets are: recovery point of 24 hours or less, and recovery time of 4 hours or less.
- The runbook (docs/incident-response.md) describes how to roll back a deployment and restore the database to a branch, test it on a preview deployment, then switch production over. The old database is kept read-only for 14 days.
- Public status information is on the status page.

## Rules
1. The restore procedure is rehearsed and timed once every quarter, and the date and duration are recorded. The first drill is due by January 2027.
2. The continuity plan, impact analysis and recovery targets are reviewed at least once a year and after any significant change to hosting or suppliers.
3. A short written impact analysis lists the platform's critical functions and how long each can be down. This is being written (target January 2027).
4. The owner and one trusted backup person know where the recovery steps and account access are kept. [CONFIRM: who is the backup person, if any?]
${REVIEW}`,
  },
  {
    slug: "data-governance-and-privacy",
    title: "Data Governance, Classification and Privacy Policy",
    category: "PRIVACY",
    covers: "DSP-01.2 DSP-03.2 DSP-05.2 DSP-06.2 DCS-06.2",
    body: `# Data Governance, Classification and Privacy Policy

## Purpose
To handle data according to its sensitivity and the promises we make in the privacy notice.

## How it works today
- Data is classified into: public scholarly content; account and submission data; and sensitive fields (encrypted integration tokens, payment references).
- A data inventory and a cookie inventory are described in the privacy notice. Processors and where data flows to are named there, including hosting, storage, email, error monitoring, rate limiting, payments, malware scanning, AI providers and DOI registration.
- No personal data is sold. Optional cookies are off until consent. The Global Privacy Control signal is honoured.
- People can view, correct, export and delete their data. Requests are answered within 30 days.
- Retention follows the privacy notice. For example, raw IP addresses are cleared after 90 days.
- For white-label portals the platform acts as processor for the portal.

## Rules
1. Personal data is used only for the purposes in the privacy notice.
2. The data inventory, data-flow description, data owners and classification are reviewed at least once a year and whenever a new processor or a new kind of data is added.
3. A new processor is added to the privacy notice before it receives data.
4. A data protection impact assessment is written for the platform and repeated after significant change (target January 2027).
${REVIEW}`,
  },
  {
    slug: "government-data-requests",
    title: "Government and Law-Enforcement Data Request Procedure",
    category: "PRIVACY",
    covers: "DSP-18.1",
    body: `# Government and Law-Enforcement Data Request Procedure

## Purpose
To respond correctly to any request from a public authority for personal data held on the platform.

## Rules
1. All such requests go to the owner. No one else discloses personal data to an authority.
2. We ask for the request in writing, identify the authority, and check the legal basis, the territory and the exact data requested.
3. We disclose only what the law requires and nothing more. We challenge requests that are unclear, too broad or not valid for our jurisdiction.
4. Unless the law forbids it, we tell the person concerned (and, for white-label portal data, the portal administrator) before disclosure.
5. Each request and our decision are recorded in the Compliance Register with the date, authority, legal basis and what was disclosed.
6. We publish how many requests we received and answered, if any, in the yearly refresh of our STAR self-assessment.
${REVIEW}`,
  },
  {
    slug: "suppliers-and-shared-responsibility",
    title: "Supplier Management and Shared Responsibility Policy",
    category: "SUPPLIERS",
    covers: "STA-01.1 STA-01.2 STA-02.1 STA-02.2 STA-06.1 STA-10.1 STA-11.1 STA-12.1 STA-13.1 STA-14.1 STA-15.1 STA-16.1 CCC-05.1",
    body: `# Supplier Management and Shared Responsibility Policy

## Purpose
To choose suppliers with care, to be clear about who is responsible for which control, and to keep checking them.

## How it works today
- Hosting, database, file storage, email, error monitoring, rate limiting, payments, malware scanning, AI providers and DOI registration are provided by third parties. They are named in the privacy notice.
- The CAIQ self-assessment states, for each control, whether we own it, the provider owns it, or it is shared.
- A software bill of materials lists components.

## Rules
1. Before a supplier receives personal data, the owner checks what data it will hold, where, under what contract, and what security evidence it publishes (for example an independent audit report).
2. A Supplier Register in the Compliance Register records, for each supplier: purpose, data held, location, contract or data-processing terms, security evidence and the date of the last review. The register is being built (target January 2027).
3. Suppliers are reviewed at least once a year, and again after any breach or major change at the supplier.
4. A supplier that handles personal data must agree to data-protection terms equivalent to ours. White-label customers receive written terms and a data-processing agreement.
5. The shared-responsibility statement (who owns which control) is reviewed and validated at least once a year.
6. If a supplier fails, the continuity policy says how we move away from it.
${REVIEW}`,
  },
  {
    slug: "network-and-infrastructure",
    title: "Network and Infrastructure Security Policy",
    category: "SECURITY",
    covers: "I&S-01.2 I&S-03.4 I&S-03.5",
    body: `# Network and Infrastructure Security Policy

## How it works today
- We run no servers or data centres. Infrastructure, network and physical security are provided by the hosting and database providers.
- We manage application configuration (headers, Content-Security-Policy, redirects, build settings) in version control.
- Every connection uses TLS. Database and service calls use credentials, and API routes require authorisation.
- Platform protections against network attacks are provided by the hosting provider; the application adds account lockout, a strict Content-Security-Policy and request rate limiting. [CONFIRM: is request rate limiting (Upstash) switched on in production?]
- Internet-facing services are: the website and its API, the status page, and the mail and DNS records of the domain. Everything else is closed.

## Rules
1. We expose no service other than the ones listed above. Any new one is justified in writing in this policy first: the port or protocol, why it is needed, and what protects it.
2. Network and DNS configuration is reviewed at least once a year (for example IPv6, DNSSEC, mail records and certificate authority records), and the result is recorded.
3. Test and live environments are kept apart (see the Secure Development policy). Preview deployments must not use the live database. This is being separated (target January 2027).
${REVIEW}`,
  },
  {
    slug: "policy-exceptions",
    title: "Policy Exception Process",
    category: "GOVERNANCE",
    covers: "GRC-04.1 CCC-08.2",
    body: `# Policy Exception Process

## Purpose
To make sure that when a rule cannot be followed, the deviation is deliberate, approved and temporary.

## Rules
1. Anyone who cannot follow a policy asks the owner for an exception before acting, except in an emergency, when they act safely and report within one working day.
2. An exception request states: the policy and rule, why it cannot be followed, the risk, the protection put in place instead, and the date it ends. No exception lasts longer than 6 months.
3. Only the owner can approve an exception. The approval is recorded in the Compliance Register.
4. Open exceptions are reviewed monthly and closed when the end date arrives or the reason disappears.
5. Emergency changes (such as an urgent security fix) that skip a normal step are recorded the same way after the event.
${REVIEW}`,
  },
  {
    slug: "audit-and-assurance",
    title: "Audit and Assurance Policy",
    category: "GOVERNANCE",
    covers: "A&A-01.1 A&A-01.2 A&A-05.1 A&A-06.1 A&A-06.2",
    body: `# Audit and Assurance Policy

## Purpose
To test regularly whether our controls work, and to fix what the tests find.

## How it works today
- Automated scanning and testing run on every change.
- We assess ourselves against OWASP ASVS Level 2, NIST CSF 2.0 and CIS Controls IG1, and publish the CSA STAR Level 1 and STAR for AI Level 1 self-assessments. These are self-assessments, not outside audits or certificates, and we describe them that way.

## Rules
1. A control assessment is planned once a year. It covers the scope, the standard used, who does it, and the date. The plan and the results are kept in the Compliance Register.
2. Findings from any assessment, scan, penetration test or customer report go into a corrective action plan with a severity, an owner and a target date.
3. Open findings are reviewed monthly and reported to the owner. Closed findings record how they were fixed.
4. An independent penetration test is planned for 2027, depending on budget. We do not describe any item as checked by an outside party until a report exists.
${REVIEW}`,
  },
  {
    slug: "interoperability-and-portability",
    title: "Interoperability and Portability Policy",
    category: "GOVERNANCE",
    covers: "IPY-01.5",
    body: `# Interoperability and Portability Policy

## How it works today
- The platform uses open standards for interfaces and exchange: a documented REST API with an OpenAPI description, OAI-PMH, JATS XML, Crossref, KBART and COUNTER/SUSHI. All transfer is over HTTPS.
- People can export their data and request deletion. White-label portals can export their content on request, and termination terms are agreed with each portal.

## Rules
1. New interfaces use open, documented standards where one exists.
2. Data exports remain available to account holders at any time and to portals when they leave.
3. This policy and the list of standards are reviewed at least once a year.
${REVIEW}`,
  },
  {
    slug: "ai-acceptable-use",
    title: "AI Acceptable Use and Explainability Policy",
    category: "AI",
    covers: "GRC-09.2 GRC-13.1 GRC-14.1 HRS-15.1",
    body: `# AI Acceptable Use and Explainability Policy

## Purpose
To use AI responsibly, openly and with human oversight.

## How it works today
- The platform uses third-party language models (Anthropic Claude and open-weight models through OpenRouter) through their programming interfaces, and two small models that run on the platform itself (a text-embedding model and a speech model). We do not train or fine-tune models.
- AI features are labelled as AI. Manuscripts and assistant questions are sent to AI providers without account details.
- AI output that affects an editorial or publication decision is a suggestion. A person decides.
- The privacy notice and the Trust page describe AI use.

## Rules
1. AI is used only for the purposes published on the Trust page and in the privacy notice. A new purpose is added there first.
2. Anyone working on the platform may use AI tools for platform work only through the tools and settings the owner has approved. They must not paste personal data, unpublished manuscripts or secrets into an unapproved AI tool.
3. For every AI feature the AI Register states what it does, which model it uses, what data goes in, how its answers can be wrong, and how a person can check or override it. This is the platform's explanation of how each feature works and what its limits are. The register is being built (target February 2027).
4. The effectiveness of this policy is reviewed at least once a year, using the AI usage log and user feedback.
${REVIEW}`,
  },
  {
    slug: "people-security",
    title: "People Security Policy",
    category: "PEOPLE",
    covers: "HRS-01.1 HRS-01.2 HRS-01.3 HRS-02.1 HRS-02.2 HRS-03.1 HRS-03.2 HRS-04.1 HRS-04.2 HRS-05.1 HRS-06.1 HRS-07.1 HRS-08.1 HRS-09.1 HRS-10.1 HRS-13.1",
    body: `# People Security Policy

## Scope
Anyone who is given access to the platform's systems or data: employees, contractors, volunteers and editors. [CONFIRM: who works on the platform besides the owner today? Replace with a one-line description. If it is only the owner, keep the rules below as the rules that apply the moment anyone else is given access.]

## Rules
1. Before access: we check identity and relevant background in proportion to the access given and local law. Anyone with access to personal data or administrator rights gets a more careful check.
2. Agreement: everyone signs an agreement or terms that include confidentiality, data protection, acceptable use and the duty to follow our policies, before they receive access.
3. Roles and duties: each person is told in writing which data and systems they may use, and that they must report mistakes and suspected incidents at once.
4. Acceptable use: platform accounts and devices are used for platform work only. Passwords are not shared. Secrets are kept in the hosting dashboard or a password manager, never in chat, email or code.
5. Unattended workspaces: screens lock when left, and confidential material is not left visible.
6. Remote work: work is done only on devices that meet the Device Security Policy, on networks we trust, or over a protected connection. Public computers are never used.
7. Changes of role and leaving: access is changed or removed the same day. Any devices, files and accounts belonging to the platform are returned or erased and the owner confirms in the Compliance Register.
8. Awareness: everyone completes the Security and AI Awareness Training before access and every year.
9. This policy and its background-check rules are reviewed at least once a year.
${REVIEW}`,
  },
  {
    slug: "security-and-ai-training",
    title: "Security and AI Awareness Training Programme",
    category: "PEOPLE",
    covers: "HRS-11.1 HRS-11.2 HRS-12.1 HRS-12.2 HRS-14.1 HRS-14.2",
    body: `# Security and AI Awareness Training Programme

## Purpose
To make sure everyone with access knows how to handle data safely and use AI responsibly.

## Rules
1. Everyone with access completes a one-hour training before receiving access, and again every 12 months. People with administrator rights or access to personal data also receive an update whenever a policy that affects them changes.
2. The training covers: recognising phishing, passwords and two-step sign-in, handling personal data and manuscripts, reporting an incident, the device rules, and the AI rules (which tools are approved, what must never be pasted into them, and how to check AI output).
3. Each person signs an acknowledgement that they completed it. The acknowledgement and date are kept in the Compliance Register.
4. Training content is reviewed every year, and updated when a new threat or a new AI feature calls for it.
${REVIEW}`,
  },
  {
    slug: "device-security",
    title: "Device Security Policy",
    category: "DEVICES",
    covers: "UEM-01.1 UEM-01.2 UEM-02.1 UEM-03.1 UEM-04.1 UEM-05.1 UEM-06.1 UEM-07.1 UEM-08.1 UEM-09.1 UEM-10.1 UEM-11.1 UEM-13.1 UEM-14.1",
    body: `# Device Security Policy

## Scope
Every laptop, desktop, phone or tablet used to work on the platform, whether owned by the owner, a contractor or a volunteer.

## Rules
1. Inventory: every such device is listed in the Device Inventory of the Compliance Register.
2. The device checklist: each device must pass the checklist before platform access, and again every 12 months and after any major change. The checklist is: whole-disk encryption is on; the screen locks by itself within 5 minutes; system and browser updates are automatic; anti-malware protection is on; the firewall is on; only apps from official stores or the vendor are installed; the device can be found, locked and wiped remotely; and two-step sign-in is on for every platform account used on it.
3. Approved software: work is done in a current browser, the code editor and tools the owner has approved, from their official sources.
4. Updates: operating system and browser security updates are installed within 14 days.
5. Data loss: manuscripts and personal data are not saved to a personal device except while working on them. They are deleted afterwards. They are never put in personal cloud storage or sent by personal email.
6. Loss or theft: report it the same day. The owner signs out the person's sessions and rotates any secret that was on the device.
7. Other people's devices: a contractor or volunteer using their own device must pass the same checklist, and the result is recorded.
8. Remote deletion: platform data can be removed remotely by signing out sessions and removing the device's access in each service.
${REVIEW}`,
  },
];
