"use client";

// ---------------------------------------------------------------------------
// ContentDataTables — fetches a content item's extracted tables (any of the
// *-data-tables API routes, all sharing the same { tables } response shape)
// and renders one DataTableChart per table. Silently renders nothing when
// there are none, rather than an empty-state block — unlike the Article
// Supplemental tab (a dedicated, always-visible section), this mounts
// inline in a magazine piece/media post reader where most items simply
// have no tables at all.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { DataTableChart, type DataTableChartTable } from "./data-table-chart";

export function ContentDataTables({ apiPath, filenamePrefix }: { apiPath: string; filenamePrefix: string }) {
  const [tables, setTables] = useState<DataTableChartTable[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ tables: DataTableChartTable[] }>(apiPath)
      .then((res) => {
        if (!cancelled) setTables(res.tables);
      })
      .catch(() => {
        if (!cancelled) setTables([]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath]);

  if (!tables || tables.length === 0) return null;

  return (
    <div className="space-y-6">
      <p className="eyebrow border-b border-foreground/10 pb-3">Data &amp; tables</p>
      {tables.map((t, i) => (
        <DataTableChart key={i} table={t} filenameBase={`${filenamePrefix}-table-${i + 1}`} />
      ))}
    </div>
  );
}
