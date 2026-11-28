/**
 * How the platform applies the MyData Declaration, shown on the Trust page, the
 * Privacy page and the Cookie Policy. Each point is tied to a feature that exists
 * (see the Privacy Policy), so the three pages cannot drift apart. Platform site only:
 * the Declaration is Eleventh Press's own signature, so white-label sites never show it.
 */
export const MYDATA_PRACTICES: { a: string; b: string }[] = [
  { a: "See and take your data", b: "Download a JSON copy of your profile, submissions, reviews, invoices and notifications at any time from the Profile tab." },
  { a: "Delete your account", b: "Deleting your account anonymises every personal field on it straight away. Reviews you signed show as \u201cDeleted User\u201d." },
  { a: "Choice before optional tracking", b: "Only strictly necessary cookies are set by default. The one optional cookie is set only if you accept it in the banner, and you can change your choice at any time. A browser\u2019s Global Privacy Control signal is honoured automatically." },
  { a: "No selling of personal data", b: "We do not sell personal data or share it for advertising." },
  { a: "Open about who handles it", b: "The Privacy Policy names each type of provider that handles data for us and why, including what the AI model providers receive (manuscript text for editorial triage and the questions you ask the assistant, without your account details)." },
  { a: "Keeping less", b: "Raw IP addresses recorded with usage events are cleared automatically after 90 days, and you can delete any AI assistant conversation whenever you like." },
  { a: "You decide what to connect", b: "You edit your own profile. ORCID and Blogger receive data only if you connect them yourself, and two-factor authentication and passkeys are your choice." },
  { a: "Answers within 30 days", b: "Access, correction and other data requests sent to our privacy contact get a reply within 30 days." },
];

export const MYDATA_INTRO = "The MyData Declaration puts people in control of their own personal data. These are the practices on this platform that serve that aim today.";

export const MYDATA_LIMITS =
  "Signing is a commitment, not a certification or an audit, and MyData has not reviewed this platform. Some data stays by design: published articles with a DOI and financial records are kept as the permanent record, and the byline on a published article is not changed after an account is deleted. Some providers receive limited technical data to run the service, for example error monitoring can include an IP address. We will update this section as our practice changes.";

export const MYDATA_TRUST_URL = "/trust#mydata";
