/**
 * Starting records for the Compliance Register (phase 2). They load as DRAFT.
 * Each states only what the code and the policy drafts already show, and
 * leaves a [CONFIRM: …] note wherever a fact is the owner's to give.
 */
import type { RecordKind } from "@/lib/compliance-records";

export interface RecordSeed {
  /** Stable key so loading twice never duplicates a record. */
  seedKey: string;
  kind: RecordKind;
  title: string;
  data: Record<string, string>;
  isPublic?: boolean;
}

const supplier = (seedKey: string, title: string, purpose: string, dataShared: string, location: string, safeguards: string): RecordSeed => ({
  seedKey,
  kind: "SUPPLIER",
  title,
  isPublic: true,
  data: { purpose, dataShared, location, safeguards },
});

const CHECK_TERMS = "[CONFIRM: have you accepted this supplier's data processing terms? Replace this note with the agreement you accepted.]";

export const RECORD_SEEDS: RecordSeed[] = [
  // ---- Suppliers: one per service the code connects to ----
  supplier("sup-vercel", "Vercel", "Hosting and delivery of the website and the platform's server code.", "Everything the platform processes passes through it: requests, account sessions, and uploaded files kept in its storage.", "United States, with a global delivery network. [CONFIRM: the region your project runs in.]", CHECK_TERMS),
  supplier("sup-postgres", "Managed Postgres database", "Stores all platform data: accounts, submissions, reviews and settings.", "All account and submission data.", "[CONFIRM: the database provider and its region.]", `${CHECK_TERMS} [CONFIRM: are backups and point-in-time recovery switched on?]`),
  supplier("sup-resend", "Resend", "Sends the platform's emails: sign-in codes, notices and reminders.", "Recipient email address, and the text of the message.", "United States. [CONFIRM: check the region in your Resend account.]", CHECK_TERMS),
  supplier("sup-upstash", "Upstash", "Request rate limiting that protects sign-in and public forms.", "A hashed or shortened network identifier of the visitor, with request counts. [CONFIRM: check what identifier is stored.]", "[CONFIRM: the region of your Upstash database.]", CHECK_TERMS),
  supplier("sup-sentry", "Sentry", "Records application errors so they can be fixed.", "Error details and technical context. Personal data is not meant to be included. [CONFIRM: check your Sentry data scrubbing settings.]", "[CONFIRM: the Sentry region of your project.]", CHECK_TERMS),
  supplier("sup-virustotal", "VirusTotal", "Malware scanning of uploaded files.", "Uploaded files or their fingerprints. [CONFIRM: check which of the two is sent, and whether uploads are scanned before they are made public.]", "[CONFIRM: processing location.]", `${CHECK_TERMS} Files sent to VirusTotal can be seen by its security partners. [CONFIRM: is this acceptable for unpublished manuscripts? If not, state how they are excluded.]`),
  supplier("sup-google", "Google sign-in", "Lets people choose to sign in with their Google account.", "The name, email address and profile identifier Google shares when a person signs in with it.", "United States and other Google locations.", CHECK_TERMS),
  supplier("sup-orcid", "ORCID", "Lets people choose to sign in with and link their ORCID iD.", "The ORCID iD and name that ORCID shares when a person signs in with it.", "ORCID's own infrastructure.", CHECK_TERMS),
  supplier("sup-ai", "AI model providers (Anthropic and OpenRouter)", "The AI features: assistant answers and manuscript help.", "Manuscript text and assistant questions, sent without account details.", "[CONFIRM: processing locations of both providers.]", `${CHECK_TERMS} [CONFIRM: confirm that your accounts with both providers do not allow your content to be used for training.]`),
  supplier("sup-zenodo", "Zenodo", "Deposits open datasets and registers DOIs when an author chooses to publish.", "The title, authors and files the author chooses to deposit.", "CERN, Switzerland. [CONFIRM: check Zenodo's current hosting statement.]", "Used only when an author chooses to deposit. [CONFIRM: terms accepted.]"),

  // ---- Risks ----
  { seedKey: "risk-single-owner", kind: "RISK", title: "One person holds all the access", data: { description: "The platform is run by one person. If they are unavailable, ill or lose access to their accounts, nobody can fix problems or recover the platform.", likelihood: "", impact: "HIGH", controls: "Recovery steps are written down in the continuity policy. [CONFIRM: who is the trusted backup person and what can they do?]" } },
  { seedKey: "risk-shared-db", kind: "RISK", title: "Test and live versions share one database", data: { description: "Preview builds of the site use the same database as the live site, so a mistake in a preview could touch live data.", likelihood: "", impact: "HIGH", controls: "Disclosed on the Trust page. Changes that create new tables are only additive. A separate database for previews is planned (target early 2027)." } },
  { seedKey: "risk-account-takeover", kind: "RISK", title: "An administrator account is taken over", data: { description: "Phishing or a stolen password gives an attacker an administrator or editor account.", likelihood: "", impact: "HIGH", controls: "Two-step sign-in is required for administrator and editor roles in the dashboard. Accounts lock after repeated failures. Roles are reviewed once a year." } },
  { seedKey: "risk-supplier-outage", kind: "RISK", title: "A key supplier has an outage or a breach", data: { description: "Hosting, the database, email or another supplier fails or is breached.", likelihood: "", impact: "", controls: "Suppliers are listed with what data they receive. Their status and security notices are watched. The incident policy says when to tell users and regulators." } },
  { seedKey: "risk-ai-wrong", kind: "RISK", title: "AI output is wrong or unfair", data: { description: "An AI feature gives a wrong, biased or invented answer and someone relies on it.", likelihood: "", impact: "", controls: "AI features are labelled. Output that affects an editorial decision is a suggestion and a person decides. The AI acceptable use policy and the AI impact assessment cover this." } },
  { seedKey: "risk-key-loss", kind: "RISK", title: "A secret key is lost or leaked", data: { description: "The key that encrypts stored integration tokens, or the key that signs sessions, is lost or exposed.", likelihood: "", impact: "HIGH", controls: "Keys are kept in the hosting provider's protected settings, not in the code. Each key is listed in Keys and secrets with how to change it." } },

  // ---- Keys and secrets (names only, never values) ----
  { seedKey: "key-field-encryption", kind: "KEY", title: "Field encryption key", data: { purpose: "Encrypts integration tokens (such as connected-account tokens) stored in the database.", storedAs: "FIELD_ENCRYPTION_KEY (hosting provider's protected settings)", rotationPlan: "A change makes already-stored encrypted tokens unreadable. Plan: change the key, then ask people to reconnect their linked accounts. [CONFIRM: you accept this plan until a re-encryption tool exists.]" } },
  { seedKey: "key-session", kind: "KEY", title: "Session signing secret", data: { purpose: "Signs the cookies that keep people signed in.", storedAs: "SESSION_SECRET (hosting provider's protected settings)", rotationPlan: "Change the setting and redeploy. Everyone is signed out once and signs in again. [CONFIRM: you accept this plan.]" } },
  { seedKey: "key-cron", kind: "KEY", title: "Scheduled-jobs secret", data: { purpose: "Proves that a scheduled job request really comes from the platform's scheduler.", storedAs: "CRON_SECRET (hosting provider's protected settings)", rotationPlan: "Change the setting and redeploy. No user is affected. [CONFIRM: you accept this plan.]" } },

  // ---- Assessments ----
  {
    seedKey: "assess-dpia",
    kind: "ASSESSMENT",
    title: "Data protection impact assessment: the platform",
    data: {
      type: "DPIA",
      scope: "Account, submission, review and messaging data processed by the Eleventh Press platform.",
      body: `# Data protection impact assessment

## What is processed
- Account data: name, email address, affiliation, role, sign-in and security settings.
- Submission data: manuscripts, reviews, editorial decisions and messages.
- Technical data: network addresses (cleared after 90 days), sessions, error reports.
- Sensitive fields: encrypted integration tokens and payment references.

## Why, and on what basis
Data is used to run accounts, peer review and publication, and to keep the platform secure. Optional cookies are off until consent. No personal data is sold.

## Who receives it
The suppliers listed in the Supplier register. The public list shows each one's purpose and location.

## Risks to people, and what reduces them
- Someone reads data they should not: roles limit access, two-step sign-in is required for administrator and editor roles, tokens are encrypted, and access is reviewed yearly.
- Data is kept too long: retention periods follow the privacy notice.
- A supplier fails or is breached: see the risk register and the incident policy.
- A person cannot exercise their rights: people can view, correct, export and delete their data, and requests are answered within 30 days.

## Open questions for the owner
[CONFIRM: are there any large-scale or special-category data uses (for example health or children's data) that this assessment must add?]
[CONFIRM: do you agree the risks above are the right ones, and is the remaining risk acceptable? Replace with your conclusion.]

## Review
Repeat after any significant change, and at least once a year.`,
    },
  },
  {
    seedKey: "assess-ai",
    kind: "ASSESSMENT",
    title: "AI impact assessment: the platform's AI features",
    data: {
      type: "AI_IMPACT",
      scope: "AI features: assistant answers, manuscript help, text embeddings and speech.",
      body: `# AI impact assessment

## What the AI does
- Third-party language models (Anthropic Claude and open-weight models through OpenRouter) answer questions and help with manuscripts.
- Two small models run on the platform itself: a text-embedding model and a speech model.
- We do not train or fine-tune models.

## Data used
Manuscript text and assistant questions are sent to the providers without account details. See the Supplier register for the providers.

## Who could be affected, and how
- Authors and reviewers, if an AI answer is wrong, biased or invented.
- Anyone whose text is sent to a provider.

## What reduces the risk
- AI features are labelled as AI.
- Output that affects an editorial or publication decision is a suggestion. A person decides.
- The AI acceptable use policy sets the rules, and the Trust page and privacy notice describe AI use.

## Known limits
Models can be wrong or biased and cannot always explain their answers. Do not rely on them alone.

## Open questions for the owner
[CONFIRM: is any AI feature used to rank, screen or reject people or manuscripts without a person deciding? Replace with the true answer.]
[CONFIRM: do you agree the risks above are the right ones, and is the remaining risk acceptable? Replace with your conclusion.]

## Review
Repeat when a new AI feature or provider is added, and at least once a year.`,
    },
  },
];
