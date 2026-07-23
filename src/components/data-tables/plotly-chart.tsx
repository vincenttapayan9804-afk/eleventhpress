"use client";

// ---------------------------------------------------------------------------
// PlotlyChart — thin wrapper so the ~1MB plotly.js-dist-min bundle is only
// ever fetched by the dynamic(ssr:false) import in data-table-chart.tsx,
// never as part of any page's initial bundle.
// ---------------------------------------------------------------------------

import Plot from "react-plotly.js";
import type { Data, Layout } from "plotly.js";

export function PlotlyChart({ data, layout }: { data: Data[]; layout?: Partial<Layout> }) {
  return (
    <Plot
      data={data}
      layout={{
        autosize: true,
        margin: { t: 10, r: 10, b: 40, l: 50 },
        font: { size: 11, family: "inherit" },
        legend: { orientation: "h" },
        ...layout,
      }}
      config={{ responsive: true, displaylogo: false }}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
