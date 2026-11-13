"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { apiFetch } from "@/lib/api-client";
import { useApp } from "@/lib/store";

interface Data {
  days: number;
  totals: { articles: number; views: number; downloads: number; citations: number; periodViews: number; periodDownloads: number };
  series: { date: string; views: number; downloads: number }[];
  countries: { key: string; count: number }[];
  referrers: { key: string; count: number }[];
  articles: { id: string; title: string; publishedAt: string | null; views: number; downloads: number; citations: number; period: { views: number; downloads: number } }[];
}

const config = {
  views: { label: "Views", color: "var(--chart-1)" },
  downloads: { label: "Downloads", color: "var(--chart-2)" },
} satisfies ChartConfig;

const regionName = (code: string) => {
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

function BarList({ title, rows, label }: { title: string; rows: { key: string; count: number }[]; label: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card className="paper-card">
      <CardHeader className="pb-2"><h3 className="font-display text-base font-semibold">{title}</h3></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough data yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                <div className="relative overflow-hidden rounded">
                  <div className="absolute inset-y-0 left-0 rounded bg-primary/15" style={{ width: `${(r.count / max) * 100}%` }} />
                  <span className="relative block truncate px-2 py-1">{label(r.key)}</span>
                </div>
                <span className="tabular-nums text-muted-foreground">{r.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Dashboard → Article analytics: readership of the author's published work. */
export function AuthorAnalyticsTab() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch<Data>(`/api/author-analytics?days=${days}`).then((d) => live && setData(d)).catch(() => {});
    return () => {
      live = false;
    };
  }, [days]);

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (data.totals.articles === 0) {
    return (
      <Card className="paper-card">
        <CardContent className="py-14 text-center">
          <p className="font-display text-lg font-semibold">No published articles yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Readership, downloads and citations appear here once your first article is published.</p>
        </CardContent>
      </Card>
    );
  }

  const tiles = [
    { label: `Views · last ${data.days} days`, value: data.totals.periodViews },
    { label: `Downloads · last ${data.days} days`, value: data.totals.periodDownloads },
    { label: "Views, all time", value: data.totals.views },
    { label: "Citations", value: data.totals.citations },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Readership</h2>
        <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Period">
          {[30, 90, 365].map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`rounded px-3 py-1 font-medium ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {d === 365 ? "1 year" : `${d} days`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="paper-card">
            <CardContent className="p-4">
              <p className="font-display text-3xl font-semibold tabular-nums">{t.value.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="paper-card">
        <CardHeader className="pb-0"><h3 className="font-display text-base font-semibold">Views and downloads per day</h3></CardHeader>
        <CardContent className="pt-4">
          <ChartContainer config={config} className="h-64 w-full">
            <LineChart data={data.series} margin={{ left: 0, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
              <ChartTooltip cursor={{ strokeOpacity: 0.3 }} content={<ChartTooltipContent indicator="line" labelFormatter={(d) => new Date(String(d)).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="views" stroke="var(--color-views)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="downloads" stroke="var(--color-downloads)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <BarList title="Where readers are" rows={data.countries} label={regionName} />
        <BarList title="How readers arrive" rows={data.referrers} label={(k) => k} />
      </div>

      <Card className="paper-card">
        <CardHeader className="pb-2"><h3 className="font-display text-base font-semibold">By article</h3></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Article</th>
                <th className="py-2 pr-3 text-right font-medium">Views ({data.days}d)</th>
                <th className="py-2 pr-3 text-right font-medium">Downloads ({data.days}d)</th>
                <th className="py-2 pr-3 text-right font-medium">Views (all)</th>
                <th className="py-2 text-right font-medium">Citations</th>
              </tr>
            </thead>
            <tbody>
              {data.articles.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="max-w-[320px] py-2.5 pr-3">
                    <button type="button" onClick={() => useApp.getState().openArticle(a.id)} className="line-clamp-2 text-left hover:text-primary">{a.title}</button>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{a.period.views.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{a.period.downloads.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{a.views.toLocaleString()}</td>
                  <td className="py-2.5 text-right tabular-nums">{a.citations.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">Countries and referring sites are recorded from November 2026 onwards.</p>
        </CardContent>
      </Card>
    </div>
  );
}
