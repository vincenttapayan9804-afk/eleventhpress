import { fmtArchiveDate, type ArchiveItem } from "@/lib/archive";

/** A plain list of articles: title link, authors, date and issue. Server-rendered, no JavaScript. */
export function ArchiveList({ items }: { items: ArchiveItem[] }) {
  return (
    <ol className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.path} className="py-4">
          <a href={a.path} className="font-display text-lg font-semibold leading-snug text-foreground hover:text-primary hover:underline">
            {a.title}
          </a>
          {a.authors && <p className="mt-1 text-sm text-muted-foreground">{a.authors}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            <time dateTime={a.publishedAt.toISOString().slice(0, 10)}>{fmtArchiveDate(a.publishedAt)}</time>
            {a.journal ? ` · ${a.journal}` : ""}
            {a.volume ? ` · Vol. ${a.volume}` : ""}
            {a.issue ? ` · No. ${a.issue}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
