/**
 * ONIX for Books 3.0 export (reference-tag composite), for the book
 * distribution platforms this repo already targets in
 * src/lib/book-distribution.ts (IngramSpark, Draft2Digital, and any
 * retailer/library wholesaler/aggregator that ingests an ONIX feed rather
 * than a manual form). Unlike Crossref/Zenodo (src/lib/crossref.ts,
 * src/lib/zenodo.ts), ONIX has no live submission API to deposit
 * against — every real-world consumer (IngramSpark, Amazon KDP, library
 * wholesalers, etc.) takes the file via an upload/FTP/self-serve import
 * step a human still has to do — so this module only ever builds a file;
 * there's no LiveMode()/depositTo...() pair here, and no network calls.
 *
 * Element structure and code values were cross-checked against EDItEUR's
 * published ONIX for Books 3.0 codelists and the "Introduction to ONIX for
 * Books 3.0" spec during this change (Product composite block order —
 * DescriptiveDetail, CollateralDetail, ContentDetail, PublishingDetail,
 * RelatedMaterial, ProductSupply — and the codes cited inline below), but
 * this sandbox had no direct network access to fetch editeur.org itself to
 * validate against the real XSD the way src/lib/ojs-native.ts's docstring
 * describes doing for PKP's schema — so treat this as a well-sourced best
 * effort, not xmllint-against-the-real-XSD verified, and validate a sample
 * export with a real ONIX validator (e.g. onixcheck, or your target
 * platform's own ONIX ingestion preview) before a first live submission.
 *
 * Known, deliberate data-model limitations (never fabricated to fill a
 * gap):
 *  - Book has one ISBN field, not one per format. When both an EPUB and a
 *    print-ready PDF exist, this emits two <Product> records (one per
 *    format) that both cite the same ISBN — a fully compliant multi-format
 *    ONIX feed would assign each format its own ISBN. Flag this to your
 *    distributor/ISBN agency rather than treating the shared ISBN as
 *    correct once real per-format ISBNs exist.
 *  - No page count, no BISAC/BIC/Thema subject code, no trim size/weight
 *    (needed for accurate print POD listings) exist in the Book model —
 *    these elements are simply omitted rather than invented. Book.category
 *    (free text, e.g. "Physics") is carried as an uncontrolled Keywords
 *    subject (scheme 20), not a fabricated BISAC code.
 *  - Only PUBLISHED books are exported (see the API routes) — a
 *    forthcoming-book listing needs a firm expected publication date,
 *    which this schema doesn't track separately from the actual
 *    publishedAt set at publish time.
 */

const SENDER_NAME = "Eleventh Press International Publishing";
const SENDER_EMAIL = "editorial@eleventhpress.org";
/** Only language this platform's submission/production pipeline supports today — see src/lib/site.ts's ARTICLE_LANGUAGE. */
const ONIX_LANGUAGE_CODE = "eng"; // ISO 639-2/B, per ONIX List 74

export interface OnixAuthorInput {
  name: string;
  affiliation?: string;
  orcid?: string;
}

export interface OnixBookInput {
  id: string;
  title: string;
  subtitle?: string | null;
  authors: string; // JSON array of {name, affiliation, orcid}, same shape as Article.authors
  description: string;
  category: string;
  isbn?: string | null;
  price?: number | null;
  publishedAt: Date | string | null;
  epubKey?: string | null;
  pdfKey?: string | null;
  canonicalUrl: string;
}

export interface OnixProduct {
  kind: "epub" | "print";
  recordReference: string;
  xml: string;
}

/**
 * Builds one <Product> per distributable format the book actually has
 * (EPUB, print-ready PDF) rather than guessing at a single "primary"
 * format. A book with neither file yet produces no products — there's
 * nothing real to list.
 */
export function buildOnixProductsForBook(book: OnixBookInput): OnixProduct[] {
  const products: OnixProduct[] = [];
  if (book.epubKey) {
    products.push({
      kind: "epub",
      recordReference: `epip-book-${book.id}-epub`,
      xml: buildProductXml(book, "epub"),
    });
  }
  if (book.pdfKey) {
    products.push({
      kind: "print",
      recordReference: `epip-book-${book.id}-print`,
      xml: buildProductXml(book, "print"),
    });
  }
  return products;
}

function buildProductXml(book: OnixBookInput, edition: "epub" | "print"): string {
  const authors = parseAuthorsJson(book.authors);
  const recordReference = `epip-book-${book.id}-${edition}`;
  const pubDate = book.publishedAt ? new Date(book.publishedAt) : new Date();
  const year = pubDate.getFullYear();
  const month = String(pubDate.getMonth() + 1).padStart(2, "0");
  const day = String(pubDate.getDate()).padStart(2, "0");

  const isbnDigits = book.isbn ? book.isbn.replace(/[^0-9Xx]/g, "").toUpperCase() : "";
  const isbnXml = isbnDigits
    ? `
      <ProductIdentifier>
        <ProductIDType>15</ProductIDType>
        <IDValue>${esc(isbnDigits)}</IDValue>
      </ProductIdentifier>`
    : "";

  // ProductForm/ProductFormDetail per ONIX List 150 / List 175. "ED" is
  // digital download (an E1xx ProductFormDetail is required alongside it);
  // "BC" is paperback / softback — this platform's print galley is
  // print-ready POD stock, not a hardback, so BC is the honest default
  // absent a binding-type field on Book.
  const productFormXml =
    edition === "epub"
      ? `<ProductForm>ED</ProductForm>\n      <ProductFormDetail>E101</ProductFormDetail>`
      : `<ProductForm>BC</ProductForm>`;

  const subtitleXml = book.subtitle
    ? `\n          <Subtitle>${esc(book.subtitle)}</Subtitle>`
    : "";

  const contributorsXml = buildContributorsXml(authors);

  const priceXml =
    book.price != null && book.price > 0
      ? `
        <Price>
          <PriceType>01</PriceType>
          <PriceAmount>${book.price.toFixed(2)}</PriceAmount>
          <CurrencyCode>USD</CurrencyCode>
        </Price>`
      : "";

  return `  <Product>
    <RecordReference>${esc(recordReference)}</RecordReference>
    <NotificationType>03</NotificationType>
    <ProductIdentifier>
      <ProductIDType>01</ProductIDType>
      <IDTypeName>EPIP</IDTypeName>
      <IDValue>${esc(book.id)}</IDValue>
    </ProductIdentifier>${isbnXml}
    <DescriptiveDetail>
      <ProductComposition>00</ProductComposition>
      ${productFormXml}
      <TitleDetail>
        <TitleType>01</TitleType>
        <TitleElement>
          <TitleElementLevel>01</TitleElementLevel>
          <TitleText>${esc(book.title)}</TitleText>${subtitleXml}
        </TitleElement>
      </TitleDetail>
${contributorsXml}
      <Language>
        <LanguageRole>01</LanguageRole>
        <LanguageCode>${ONIX_LANGUAGE_CODE}</LanguageCode>
      </Language>
      <Subject>
        <SubjectSchemeIdentifier>20</SubjectSchemeIdentifier>
        <SubjectHeadingText>${esc(book.category)}</SubjectHeadingText>
      </Subject>
    </DescriptiveDetail>
    <CollateralDetail>
      <TextContent>
        <TextType>03</TextType>
        <ContentAudience>00</ContentAudience>
        <Text>${esc(book.description)}</Text>
      </TextContent>
    </CollateralDetail>
    <PublishingDetail>
      <Publisher>
        <PublishingRole>01</PublishingRole>
        <PublisherName>${esc(SENDER_NAME)}</PublisherName>
      </Publisher>
      <PublishingStatus>04</PublishingStatus>
      <PublishingDate>
        <PublishingDateRole>01</PublishingDateRole>
        <Date>${year}${month}${day}</Date>
      </PublishingDate>
    </PublishingDetail>
    <ProductSupply>
      <Market>
        <Territory>
          <RegionsIncluded>WORLD</RegionsIncluded>
        </Territory>
      </Market>
      <SupplyDetail>
        <Supplier>
          <SupplierRole>01</SupplierRole>
          <SupplierName>${esc(SENDER_NAME)}</SupplierName>
        </Supplier>
        <ProductAvailability>20</ProductAvailability>${priceXml}
      </SupplyDetail>
    </ProductSupply>
  </Product>`;
}

/**
 * Builds <Contributor> composites. Per ONIX List 44, ORCID is NameIDType
 * 21 and is recorded as the bare 16-digit ID (no hyphens, no https://
 * URI prefix) — verified against multiple independent ONIX implementation
 * references during this change, not assumed from the hyphenated form
 * this platform stores elsewhere (Article/Book author JSON, Crossref
 * deposits, the public author-facing UI).
 */
function buildContributorsXml(authors: OnixAuthorInput[]): string {
  return authors
    .map((a, i) => {
      const cleanName = (a.name || "").replace(/^Dr\.?\s+|^Prof\.?\s+/, "");
      const parts = cleanName.split(" ").filter(Boolean);
      const given = parts.slice(0, -1).join(" ");
      const family = parts.slice(-1).join(" ") || cleanName;
      const namesBeforeKeyXml = given ? `\n        <NamesBeforeKey>${esc(given)}</NamesBeforeKey>` : "";
      const orcidDigits = a.orcid ? a.orcid.replace(/[^0-9Xx]/g, "").toUpperCase() : "";
      const nameIdentifierXml = orcidDigits
        ? `\n        <NameIdentifier>\n          <NameIDType>21</NameIDType>\n          <IDValue>${esc(orcidDigits)}</IDValue>\n        </NameIdentifier>`
        : "";
      const affiliationXml = a.affiliation
        ? `\n        <ProfessionalAffiliation>\n          <Affiliation>${esc(a.affiliation)}</Affiliation>\n        </ProfessionalAffiliation>`
        : "";
      return `      <Contributor>
        <SequenceNumber>${i + 1}</SequenceNumber>
        <ContributorRole>A01</ContributorRole>${nameIdentifierXml}
        <PersonName>${esc(cleanName)}</PersonName>${namesBeforeKeyXml}
        <KeyNames>${esc(family)}</KeyNames>${affiliationXml}
      </Contributor>`;
    })
    .join("\n");
}

function parseAuthorsJson(raw: string): OnixAuthorInput[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** ONIX SentDateTime format: YYYYMMDDTHHMMSS (no punctuation), per List-driven DateTimeFormat 05. */
function sentDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Wraps one or more books' <Product> composites in a single <ONIXMessage>.
 * Books with neither an EPUB nor a print-ready file yet (nothing real to
 * list) are silently skipped rather than emitting an empty/placeholder
 * Product.
 */
export function buildOnixMessage(books: OnixBookInput[]): string {
  const products = books.flatMap((b) => buildOnixProductsForBook(b).map((p) => p.xml));
  const now = new Date();

  return `<?xml version="1.0" encoding="UTF-8"?>
<ONIXMessage release="3.0" xmlns="http://ns.editeur.org/onix/3.0/reference">
  <Header>
    <Sender>
      <SenderName>${esc(SENDER_NAME)}</SenderName>
      <EmailAddress>${esc(SENDER_EMAIL)}</EmailAddress>
    </Sender>
    <SentDateTime>${sentDateTime(now)}</SentDateTime>
  </Header>
${products.join("\n")}
</ONIXMessage>`;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
