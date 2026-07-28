"use client";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";
import { useTheme, ThemeToggle, type Palette } from "./ThemeProvider";

/* ────────────────────────────────────────────────────────────── */
/*  TYPES                                                        */
/* ────────────────────────────────────────────────────────────── */
interface ModelMetricsClf {
  accuracy: number; precision: number; recall: number; f1: number;
  auc?: number; n_test?: number;
  feature_importance?: Record<string, number>;
}
interface ModelMetricsReg {
  mae: number; rmse: number; r2: number;
  n_test?: number;
  feature_importance?: Record<string, number>;
}
interface McNemarResult { b: number; c: number; chi2: number; p: number }
interface StatSource {
  n_days: number; corr_same_day: number; corr_next_day: number;
  corr_lag1?: number; naive_accuracy: number;
  conclusion: string; detail: string;
}

export interface DashboardData {
  last_updated: string;
  today_price: number | null;
  today_date: string | null;
  model_start_date?: string;
  model_end_date?: string;
  test_cutoff?: string;
  model_days?: number;
  total_price_days?: number;
  sentiment_coverage_pct?: number;
  fg_coverage_pct?: number;
  best_sentiment_source?: string;
  statistical_analysis?: Record<string, StatSource>;
  /* Legacy format (baseline vs full) */
  classifier: {
    baseline: ModelMetricsClf;
    full: ModelMetricsClf;
    mcnemar?: McNemarResult;
  };
  regression: {
    baseline: ModelMetricsReg;
    full: ModelMetricsReg;
  };
  /* Detailed multi-model (v4) */
  classifier_detail?: {
    models_own_test: Record<string, ModelMetricsClf>;
    models_fair_test: Record<string, ModelMetricsClf>;
    mcnemar: Record<string, McNemarResult>;
    n_common_days?: number;
  };
  regression_detail?: {
    models_own_test: Record<string, ModelMetricsReg>;
    models_fair_test: Record<string, ModelMetricsReg>;
  };
  price_history:   { date: string; real: number }[];
  price_test:      { date: string; real: number; pred_base: number; pred_full: number }[];
  forecast_7d:     { date: string; pred_base: number; pred_full: number }[];
  sentiment_daily: { date: string; sentiment: number; price: number }[];
  fg_daily?:       { date: string; fg_value: number; price: number }[];
  reddit_posts:    { date: string; title: string; score: number; num_comments: number; sent_score: number | null; url: string }[];
}

/* ────────────────────────────────────────────────────────────── */
/*  CONSTANTS                                                    */
/* ────────────────────────────────────────────────────────────── */
const MODEL_LABELS: Record<string, string> = {
  baseline:   "Baseline",
  reddit:     "+ Reddit",
  fear_greed: "+ Fear & Greed",
  combined:   "+ Combinado",
};
const modelColor = (P: Palette): Record<string, string> => ({
  baseline:   P.baseline,
  reddit:     P.reddit,
  fear_greed: P.fg,
  combined:   P.combined,
});

const fmtPct  = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtUsd  = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const fmtDate = (s: string) => s ? s.slice(5) : "";

/** Estilos base compartidos por todos los charts (ejes, tooltip, grid). */
const axisBase = (P: Palette, size = 10) => ({
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: P.muted, fontSize: size, fontFamily: "var(--font-fira), monospace" },
});
const tooltipBase = (P: Palette) => ({
  backgroundColor: P.tooltipBg,
  borderColor: P.border,
  borderWidth: 1,
  padding: [8, 10] as [number, number],
  textStyle: { color: P.body, fontSize: 12, fontFamily: "var(--font-fira), monospace" },
  extraCssText: "border-radius:8px; box-shadow:0 6px 24px rgba(0,0,0,0.25);",
});

/* ────────────────────────────────────────────────────────────── */
/*  PRICE CHART                                                  */
/* ────────────────────────────────────────────────────────────── */
function PriceChart({ data }: { data: DashboardData }) {
  const { palette: P } = useTheme();

  const option = useMemo<EChartsOption>(() => {
    const testMap  = new Map((data.price_test ?? []).map(d => [d.date, d]));
    const history  = data.price_history ?? [];
    const forecast = data.forecast_7d ?? [];
    const bestSent = data.best_sentiment_source ?? "full";
    const sentLabel = MODEL_LABELS[bestSent] ?? "+Sentiment";

    const histPoints = history.map(h => {
      const t = testMap.get(h.date);
      return {
        date: h.date,
        real: h.real,
        pred_base: t?.pred_base ?? null,
        pred_full: t?.pred_full ?? null,
      };
    });
    const fcPoints = forecast.map(f => ({
      date: f.date, real: null as number | null,
      pred_base: f.pred_base, pred_full: f.pred_full,
    }));

    const rows = [...histPoints.slice(-180), ...fcPoints];
    const dates = rows.map(r => r.date);
    const todayDate = data.today_date ?? undefined;
    const testStart = Array.from(testMap.keys()).sort()[0] ?? undefined;

    const marks: { xAxis: string; label: string; color: string; dash: number[] }[] = [];
    if (testStart) marks.push({ xAxis: testStart, label: "Test →", color: P.muted, dash: [4, 3] });
    if (todayDate) marks.push({ xAxis: todayDate, label: "HOY", color: P.forecast, dash: [6, 3] });

    return {
      animationDuration: 600,
      grid: { top: 34, right: 14, bottom: 26, left: 64 },
      legend: {
        top: 0, left: 0, itemWidth: 16, itemHeight: 8, icon: "roundRect",
        textStyle: { color: P.muted, fontSize: 11 },
        data: ["Precio real", "Baseline", sentLabel],
      },
      tooltip: {
        trigger: "axis",
        ...tooltipBase(P),
        axisPointer: { type: "line", lineStyle: { color: P.muted, type: "dashed" } },
        valueFormatter: (v) => (typeof v === "number" ? fmtUsd(v) : "—"),
      },
      xAxis: {
        type: "category", data: dates, boundaryGap: false,
        ...axisBase(P),
        axisLabel: { ...axisBase(P).axisLabel, formatter: (v: string) => fmtDate(v), hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value", scale: true,
        ...axisBase(P),
        axisLabel: { ...axisBase(P).axisLabel, formatter: (v: number) => `$${v}` },
        splitLine: { lineStyle: { color: P.grid, type: "dashed", opacity: 0.45 } },
      },
      series: [
        {
          name: "Precio real", type: "line", showSymbol: false, connectNulls: false,
          data: rows.map(r => r.real),
          lineStyle: { width: 2, color: P.real }, itemStyle: { color: P.real },
          markLine: {
            symbol: "none", silent: true,
            label: { fontSize: 10 },
            data: marks.map(m => ({
              xAxis: m.xAxis, name: m.label,
              lineStyle: { color: m.color, type: m.dash, width: 1 },
              label: { show: true, formatter: m.label, color: m.color, position: "insideEndTop" as const },
            })),
          },
        },
        {
          name: "Baseline", type: "line", showSymbol: false, connectNulls: true,
          data: rows.map(r => r.pred_base),
          lineStyle: { width: 1.5, color: P.baseline, type: [5, 4] },
          itemStyle: { color: P.baseline },
        },
        {
          name: sentLabel, type: "line", showSymbol: false, connectNulls: true,
          data: rows.map(r => r.pred_full),
          lineStyle: { width: 2, color: P.full, type: [3, 2] },
          itemStyle: { color: P.full },
        },
      ],
    };
  }, [data, P]);

  return <EChart option={option} height={360} />;
}

/* ────────────────────────────────────────────────────────────── */
/*  FORECAST CARDS                                               */
/* ────────────────────────────────────────────────────────────── */
function ForecastCards({ forecast, todayPrice, bestSent }: {
  forecast: DashboardData["forecast_7d"]; todayPrice: number | null; bestSent: string;
}) {
  const { palette: P } = useTheme();
  if (!forecast?.length) return null;
  const label = MODEL_LABELS[bestSent] ?? "+Sentiment";
  return (
    <div className="glass-card p-4 fade-in">
      <p className="text-xs uppercase tracking-widest text-muted mb-3">
        Forecast 7 días — modelo {label}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {forecast.map((f, i) => {
          const prev = i === 0 ? todayPrice : forecast[i - 1].pred_full;
          const up = f.pred_full > (prev ?? f.pred_full);
          return (
            <div key={f.date} className="flex flex-col items-center gap-1 p-2 rounded-lg tint-forecast">
              <span className="text-[10px] text-muted font-mono">{fmtDate(f.date)}</span>
              <span className="text-[11px] font-mono font-bold" style={{ color: P.forecast }}>
                ${f.pred_full.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </span>
              <span style={{ color: up ? P.positive : P.negative }} className="text-xs">{up ? "↑" : "↓"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  MULTI-MODEL COMPARISON TABLE                                 */
/* ────────────────────────────────────────────────────────────── */
function ModelComparisonClf({ detail, legacy }: {
  detail?: DashboardData["classifier_detail"];
  legacy: DashboardData["classifier"];
}) {
  const { palette: P } = useTheme();
  const MC = modelColor(P);
  const fair = detail?.models_fair_test;
  const nCommon = detail?.n_common_days;
  const mcnemar = detail?.mcnemar ?? {};

  if (fair && Object.keys(fair).length > 1) {
    const modelNames = ["baseline", "reddit", "fear_greed", "combined"].filter(n => fair[n]);
    const metrics: (keyof ModelMetricsClf)[] = ["accuracy", "precision", "recall", "f1", "auc"];

    return (
      <div className="glass-card p-5 fade-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-muted">
            Comparación justa · Clasificador
          </p>
          {nCommon && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full tint-primary"
                  style={{ color: P.full }}>
              {nCommon} días en común
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted border-b border-border text-left">
                <th className="pb-2 pr-4">Métrica</th>
                {modelNames.map(n => (
                  <th key={n} className="pb-2 px-2 text-right" style={{ color: MC[n] }}>
                    {MODEL_LABELS[n]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(k => (
                <tr key={k} className="border-b border-soft">
                  <td className="py-1.5 pr-4 text-muted uppercase">{k}</td>
                  {modelNames.map(n => {
                    const val = fair[n]?.[k];
                    if (val === undefined) return <td key={n} className="py-1.5 px-2 text-right text-muted">—</td>;
                    const isBase = n === "baseline";
                    const baseVal = fair["baseline"]?.[k] ?? 0;
                    const better = (val as number) > (baseVal as number);
                    return (
                      <td key={n} className="py-1.5 px-2 text-right"
                          style={{ color: isBase ? P.muted : better ? P.positive : P.negative }}>
                        {fmtPct(val as number)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b border-soft">
                <td className="py-1.5 pr-4 text-muted uppercase">n_test</td>
                {modelNames.map(n => (
                  <td key={n} className="py-1.5 px-2 text-right text-muted">
                    {fair[n]?.n_test ?? "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {Object.keys(mcnemar).length > 0 && (
          <div className="mt-4 pt-3 border-t border-soft">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Test de McNemar</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(mcnemar).map(([key, mc]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted">
                    {key.replace("baseline_vs_", "vs ")}:
                  </span>
                  <span className="text-[10px] font-mono">χ²={mc.chi2}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${mc.p < 0.05 ? "tint-positive" : "tint-muted"}`}
                        style={{ color: mc.p < 0.05 ? P.positive : P.muted }}>
                    p={mc.p} {mc.p < 0.05 ? "✓" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* Fallback: legacy 2-model view */
  return (
    <div className="glass-card p-5 fade-in">
      <p className="text-xs uppercase tracking-widest text-muted mb-3">Clasificador · Baseline vs +Sentiment</p>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-muted border-b border-border text-left">
            <th className="pb-1 pr-4">Métrica</th>
            <th className="pb-1 pr-4 text-right">Baseline</th>
            <th className="pb-1 text-right">+Sentiment</th>
          </tr>
        </thead>
        <tbody>
          {(["accuracy", "precision", "recall", "f1"] as const).map(k => (
            <tr key={k} className="border-b border-soft">
              <td className="py-1 pr-4 text-muted capitalize">{k}</td>
              <td className="py-1 pr-4 text-right text-body">{fmtPct(legacy.baseline[k])}</td>
              <td className="py-1 text-right"
                  style={{ color: legacy.full[k] >= legacy.baseline[k] ? P.positive : P.negative }}>
                {fmtPct(legacy.full[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  MULTI-MODEL REGRESSION                                       */
/* ────────────────────────────────────────────────────────────── */
function ModelComparisonReg({ detail, legacy }: {
  detail?: DashboardData["regression_detail"];
  legacy: DashboardData["regression"];
}) {
  const { palette: P } = useTheme();
  const MC = modelColor(P);
  const fair = detail?.models_fair_test;

  if (fair && Object.keys(fair).length > 1) {
    const modelNames = ["baseline", "reddit", "fear_greed", "combined"].filter(n => fair[n]);

    return (
      <div className="glass-card p-5 fade-in">
        <p className="text-xs uppercase tracking-widest text-muted mb-4">
          Comparación justa · Regresor
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted border-b border-border text-left">
                <th className="pb-2 pr-4">Métrica</th>
                {modelNames.map(n => (
                  <th key={n} className="pb-2 px-2 text-right" style={{ color: MC[n] }}>
                    {MODEL_LABELS[n]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["mae", "rmse"] as const).map(k => (
                <tr key={k} className="border-b border-soft">
                  <td className="py-1.5 pr-4 text-muted uppercase">{k}</td>
                  {modelNames.map(n => {
                    const val = fair[n]?.[k];
                    if (val === undefined) return <td key={n} className="py-1.5 px-2 text-right text-muted">—</td>;
                    const isBase = n === "baseline";
                    const baseVal = fair["baseline"]?.[k] ?? 999;
                    const better = val < baseVal;   // menor es mejor
                    return (
                      <td key={n} className="py-1.5 px-2 text-right"
                          style={{ color: isBase ? P.muted : better ? P.positive : P.negative }}>
                        {fmtUsd(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b border-soft">
                <td className="py-1.5 pr-4 text-muted uppercase">R²</td>
                {modelNames.map(n => {
                  const val = fair[n]?.r2;
                  if (val === undefined) return <td key={n} className="py-1.5 px-2 text-right text-muted">—</td>;
                  const isBase = n === "baseline";
                  const baseVal = fair["baseline"]?.r2 ?? 0;
                  const better = val > baseVal;
                  return (
                    <td key={n} className="py-1.5 px-2 text-right"
                        style={{ color: isBase ? P.muted : better ? P.positive : P.negative }}>
                      {val.toFixed(4)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-1.5 pr-4 text-muted uppercase">n_test</td>
                {modelNames.map(n => (
                  <td key={n} className="py-1.5 px-2 text-right text-muted">
                    {fair[n]?.n_test ?? "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <KpiCard label="MAE"  baseline={legacy.baseline.mae}  full={legacy.full.mae}
               format={fmtUsd} higher={false} delay="0.32" />
      <KpiCard label="RMSE" baseline={legacy.baseline.rmse} full={legacy.full.rmse}
               format={fmtUsd} higher={false} delay="0.34" />
      <KpiCard label="R²"   baseline={legacy.baseline.r2}   full={legacy.full.r2}
               format={v => v.toFixed(4)} delay="0.36" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  ACCURACY BAR CHART (multi-model)                             */
/* ────────────────────────────────────────────────────────────── */
function AccuracyBarMulti({ models }: { models: Record<string, ModelMetricsClf> }) {
  const { palette: P } = useTheme();

  const option = useMemo<EChartsOption>(() => {
    const MC = modelColor(P);
    const names = ["baseline", "reddit", "fear_greed", "combined"].filter(n => models[n]);
    const bars = names.map(n => ({
      value: models[n].accuracy,
      name: MODEL_LABELS[n],
      itemStyle: { color: MC[n], borderRadius: [4, 4, 0, 0] as [number, number, number, number] },
    }));

    return {
      animationDuration: 600,
      grid: { top: 24, right: 6, bottom: 22, left: 44 },
      tooltip: {
        trigger: "item", ...tooltipBase(P),
        formatter: (raw: unknown) => {
          const p = raw as { name: string; value: number };
          return `${p.name}<br/>Accuracy: ${fmtPct(p.value)}`;
        },
      },
      xAxis: {
        type: "category", data: bars.map(b => b.name),
        ...axisBase(P, 9), splitLine: { show: false },
      },
      yAxis: {
        type: "value", min: 0, max: 1,
        ...axisBase(P),
        axisLabel: { ...axisBase(P).axisLabel, formatter: (v: number) => fmtPct(v) },
        splitLine: { lineStyle: { color: P.grid, type: "dashed", opacity: 0.45 } },
      },
      series: [{
        type: "bar", data: bars, barMaxWidth: 46,
        label: {
          show: true, position: "top", color: P.muted, fontSize: 10,
          formatter: (raw: unknown) => fmtPct((raw as { value: number }).value),
        },
      }],
    };
  }, [models, P]);

  return <EChart option={option} height={140} />;
}

/* ────────────────────────────────────────────────────────────── */
/*  STATISTICAL ANALYSIS PANEL                                   */
/* ────────────────────────────────────────────────────────────── */
function StatAnalysis({ stats }: { stats: Record<string, StatSource> }) {
  const { palette: P } = useTheme();
  const sources = Object.entries(stats);
  if (!sources.length) return null;

  const sourceLabels: Record<string, string> = {
    reddit: "Reddit (RoBERTa)",
    fear_greed: "Fear & Greed Index",
  };

  return (
    <div className="glass-card p-5 fade-in">
      <p className="text-xs uppercase tracking-widest text-muted mb-4">
        Análisis estadístico · ¿Hay señal predictiva?
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map(([key, s]) => (
          <div key={key} className="rounded-lg p-4 inner-panel">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold" style={{ color: key === "reddit" ? P.reddit : P.fg }}>
                {sourceLabels[key] ?? key}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${s.conclusion === "NO_SIGNAL" ? "tint-negative" : "tint-positive"}`}
                    style={{ color: s.conclusion === "NO_SIGNAL" ? P.negative : P.positive }}>
                {s.conclusion === "NO_SIGNAL" ? "✗ Sin señal" : "~ Señal débil"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
              <span className="text-muted">Corr. mismo día:</span>
              <span className="text-right">{s.corr_same_day.toFixed(4)}</span>
              <span className="text-muted">Corr. día siguiente:</span>
              <span className="text-right" style={{ color: Math.abs(s.corr_next_day) > 0.05 ? P.positive : P.negative }}>
                {s.corr_next_day.toFixed(4)}
              </span>
              {s.corr_lag1 !== undefined && (
                <>
                  <span className="text-muted">Corr. lag1:</span>
                  <span className="text-right">{s.corr_lag1.toFixed(4)}</span>
                </>
              )}
              <span className="text-muted">Naive accuracy:</span>
              <span className="text-right">{fmtPct(s.naive_accuracy)}</span>
              <span className="text-muted">n días:</span>
              <span className="text-right">{s.n_days}</span>
            </div>
            <p className="text-[10px] text-muted mt-3 leading-relaxed">{s.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  FEAR & GREED CHART                                           */
/* ────────────────────────────────────────────────────────────── */
function FearGreedChart({ data }: { data: DashboardData["fg_daily"] }) {
  const { palette: P } = useTheme();

  const option = useMemo<EChartsOption>(() => {
    const rows = data ?? [];
    const sampled = rows.length > 200
      ? rows.filter((_, i) => i % Math.ceil(rows.length / 200) === 0)
      : rows;

    const fgColor = (v: number) =>
      v <= 25 ? P.negative : v <= 45 ? P.reddit : v <= 55 ? P.muted : v <= 75 ? P.positive : P.full;

    return {
      animationDuration: 600,
      grid: { top: 12, right: 12, bottom: 24, left: 34 },
      tooltip: {
        trigger: "axis", ...tooltipBase(P),
        axisPointer: { type: "shadow" },
        formatter: (raw: unknown) => {
          const ps = raw as { axisValue: string; value: number }[];
          return `${ps[0].axisValue}<br/>F&amp;G Index: <b>${ps[0].value}</b>`;
        },
      },
      xAxis: {
        type: "category", data: sampled.map(d => d.date),
        ...axisBase(P),
        axisLabel: { ...axisBase(P).axisLabel, formatter: (v: string) => fmtDate(v), hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value", min: 0, max: 100,
        ...axisBase(P),
        splitLine: { lineStyle: { color: P.grid, type: "dashed", opacity: 0.4 } },
      },
      series: [{
        type: "bar", barCategoryGap: "20%",
        data: sampled.map(d => ({
          value: d.fg_value,
          itemStyle: { color: fgColor(d.fg_value), opacity: 0.85, borderRadius: [1, 1, 0, 0] as [number, number, number, number] },
        })),
        markLine: {
          symbol: "none", silent: true, label: { show: false },
          data: [
            { yAxis: 25, lineStyle: { color: P.negative, opacity: 0.35, type: [2, 4] } },
            { yAxis: 50, lineStyle: { color: P.grid, type: [4, 4] } },
            { yAxis: 75, lineStyle: { color: P.positive, opacity: 0.35, type: [2, 4] } },
          ],
        },
      }],
    };
  }, [data, P]);

  if (!data?.length) return <p className="text-muted text-xs">Sin datos de Fear &amp; Greed</p>;
  return <EChart option={option} height={200} />;
}

/* ────────────────────────────────────────────────────────────── */
/*  SENTIMENT CHART (Reddit)                                     */
/* ────────────────────────────────────────────────────────────── */
function SentimentChart({ data }: { data: DashboardData["sentiment_daily"] }) {
  const { palette: P } = useTheme();

  const option = useMemo<EChartsOption>(() => {
    const rows = data ?? [];
    const prices = rows.map(d => d.price);
    const pMin = Math.min(...prices), pMax = Math.max(...prices);
    const norm = (v: number) => (pMax > pMin ? parseFloat(((v - pMin) / (pMax - pMin)).toFixed(4)) : 0.5);

    return {
      animationDuration: 600,
      grid: { top: 12, right: 12, bottom: 24, left: 38 },
      tooltip: {
        trigger: "axis", ...tooltipBase(P),
        axisPointer: { type: "shadow" },
        formatter: (raw: unknown) => {
          const ps = raw as { dataIndex: number }[];
          const r = rows[ps[0].dataIndex];
          return `${r.date}<br/>Sentimiento: <b>${r.sentiment.toFixed(4)}</b><br/>Precio: <b>${fmtUsd(r.price)}</b>`;
        },
      },
      xAxis: {
        type: "category", data: rows.map(d => d.date),
        ...axisBase(P),
        axisLabel: { ...axisBase(P).axisLabel, formatter: (v: string) => fmtDate(v), hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value", min: -1, max: 1,
          ...axisBase(P),
          splitLine: { lineStyle: { color: P.grid, type: "dashed", opacity: 0.4 } },
        },
        { type: "value", min: 0, max: 1, show: false },
      ],
      series: [
        {
          name: "Sentimiento", type: "bar", yAxisIndex: 0,
          data: rows.map(d => d.sentiment),
          itemStyle: { color: P.reddit, opacity: 0.75, borderRadius: [2, 2, 0, 0] as [number, number, number, number] },
          markLine: {
            symbol: "none", silent: true, label: { show: false },
            data: [{ yAxis: 0, lineStyle: { color: P.grid, type: [4, 4] } }],
          },
        },
        {
          name: "Precio (norm.)", type: "line", yAxisIndex: 1, showSymbol: false,
          data: rows.map(d => norm(d.price)),
          lineStyle: { width: 1.5, color: P.baseline, type: [4, 3] },
          itemStyle: { color: P.baseline },
        },
      ],
    };
  }, [data, P]);

  if (!data?.length) return <p className="text-muted text-xs">Sin datos de sentimiento</p>;
  return <EChart option={option} height={200} />;
}

/* ────────────────────────────────────────────────────────────── */
/*  KPI CARD (legacy fallback)                                   */
/* ────────────────────────────────────────────────────────────── */
function KpiCard({ label, baseline, full, format, higher = true, delay = "0" }: {
  label: string; baseline: number; full: number;
  format: (v: number) => string; higher?: boolean; delay?: string;
}) {
  const { palette: P } = useTheme();
  const better = higher ? full > baseline : full < baseline;
  const pct = baseline !== 0 ? Math.abs(((full - baseline) / Math.abs(baseline)) * 100).toFixed(1) : "—";
  return (
    <div className="glass-card glow-on-hover p-4 flex flex-col gap-2 fade-in"
         style={{ animationDelay: `${delay}s` }}>
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-muted mb-0.5">+Sentiment</p>
          <p className="font-mono text-xl" style={{ color: better ? P.positive : P.negative }}>{format(full)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted mb-0.5">Baseline</p>
          <p className="font-mono text-base" style={{ color: P.muted }}>{format(baseline)}</p>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono self-start ${better ? "tint-positive" : "tint-negative"}`}
            style={{ color: better ? P.positive : P.negative }}>
        {better ? "▲" : "▼"} {pct}%
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  REDDIT TABLE                                                 */
/* ────────────────────────────────────────────────────────────── */
function RedditTable({ posts }: { posts: DashboardData["reddit_posts"] }) {
  const { palette: P } = useTheme();
  const sc = (v: number | null) => v == null ? P.muted : v >= 0.05 ? P.positive : v <= -0.05 ? P.negative : P.muted;
  const sl = (v: number | null) => v == null ? "—" : v >= 0.05 ? "POS" : v <= -0.05 ? "NEG" : "NEU";
  return (
    <div className="overflow-auto max-h-[360px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="text-muted uppercase tracking-wider text-left border-b border-border">
            <th className="py-2 pr-2">Fecha</th>
            <th className="py-2 pr-2">Título</th>
            <th className="py-2 pr-2 text-right">Score</th>
            <th className="py-2 text-right">Sent.</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p, i) => (
            <tr key={i} className="border-b border-soft row-hover transition-colors">
              <td className="py-1.5 pr-2 font-mono text-muted whitespace-nowrap text-[10px]">{p.date}</td>
              <td className="py-1.5 pr-2 max-w-[260px]">
                <a href={p.url} target="_blank" rel="noreferrer"
                   className="hover:text-heading transition-colors line-clamp-1" title={p.title}>
                  {p.title}
                </a>
              </td>
              <td className="py-1.5 pr-2 font-mono text-right">{p.score.toLocaleString()}</td>
              <td className="py-1.5 text-right">
                <span className="inline-block px-1.5 py-0.5 rounded-full font-mono text-[10px]"
                      style={{ background: `${sc(p.sent_score)}22`, color: sc(p.sent_score) }}>
                  {sl(p.sent_score)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  SECTION TITLE                                                */
/* ────────────────────────────────────────────────────────────── */
function SectionTitle({ icon, label, delay }: { icon: string; label: string; delay: string }) {
  const { palette: P } = useTheme();
  return (
    <div className="flex items-center gap-2 mb-4 fade-in" style={{ animationDelay: `${delay}s` }}>
      <span style={{ color: P.full }} className="text-sm">{icon}</span>
      <h2 className="font-display font-bold text-heading text-base tracking-tight">{label}</h2>
      <div className="flex-1 h-px bg-border ml-2" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  MAIN DASHBOARD                                               */
/* ────────────────────────────────────────────────────────────── */
export function Dashboard({ data }: { data: DashboardData | null }) {
  const { palette: P } = useTheme();

  if (!data) return (
    <div className="flex min-h-screen items-center justify-center text-muted font-mono text-sm">
      Sin datos — ejecutá <code className="ml-2 text-primary">python export_for_dashboard_v4.py</code>
    </div>
  );

  const { classifier: cls, regression: reg } = data;
  const bestSent = data.best_sentiment_source ?? "full";
  const hasFG = !!(data.fg_daily?.length);
  const hasMultiModel = !!(data.classifier_detail?.models_fair_test);
  const fairClf = data.classifier_detail?.models_fair_test ?? {};

  const updatedAt = new Date(data.last_updated).toLocaleString("es-AR",
    { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="min-h-screen bg-bg text-body px-4 py-8 max-w-[1400px] mx-auto">

      {/* ── HEADER ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">◎</span>
            <h1 className="font-display font-extrabold text-3xl text-heading tracking-tight">
              SOL/USD · Sentiment Dashboard
            </h1>
          </div>
          <p className="text-sm text-muted">
            XGBoost + RoBERTa + Fear &amp; Greed Index · Precios 2024+ ·
            Test cutoff: {data.test_cutoff ?? data.model_end_date}
          </p>
        </div>
        <div className="flex gap-4 items-end">
          {data.today_price && (
            <div className="glass-card px-4 py-2 text-right">
              <p className="text-[10px] text-muted uppercase tracking-widest">Precio HOY</p>
              <p className="font-mono text-2xl font-bold" style={{ color: P.positive }}>
                {fmtUsd(data.today_price)}
              </p>
              <p className="text-[10px] text-muted">{data.today_date}</p>
            </div>
          )}
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2 items-center">
              {data.sentiment_coverage_pct != null && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full tint-reddit"
                      style={{ color: P.reddit }}>
                  Reddit {data.sentiment_coverage_pct}%
                </span>
              )}
              {data.fg_coverage_pct != null && data.fg_coverage_pct > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full tint-fg"
                      style={{ color: P.fg }}>
                  F&amp;G {data.fg_coverage_pct}%
                </span>
              )}
              <ThemeToggle />
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted uppercase tracking-widest mb-0.5">Actualizado</p>
              <p className="font-mono text-xs text-body">{updatedAt}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── PRICE CHART + FORECAST ── */}
      <section className="mb-8">
        <SectionTitle icon="◈" label="Precio Real · Test Set · Forecast 7 días" delay="0.05" />
        <div className="glass-card p-5 mb-4 fade-in">
          <p className="text-[11px] text-muted mb-3">
            <span style={{ color: P.real }}>━</span> Precio real &nbsp;
            <span style={{ color: P.baseline }}>╌</span> Baseline &nbsp;
            <span style={{ color: P.full }}>┅</span> {MODEL_LABELS[bestSent] ?? "+Sentiment"} &nbsp;·&nbsp;
            Predicciones en test set y forecast
          </p>
          <PriceChart data={data} />
        </div>
        <ForecastCards forecast={data.forecast_7d ?? []} todayPrice={data.today_price} bestSent={bestSent} />
      </section>

      {/* ── STATISTICAL ANALYSIS ── */}
      {data.statistical_analysis && Object.keys(data.statistical_analysis).length > 0 && (
        <section className="mb-8">
          <SectionTitle icon="⬡" label="Análisis Estadístico — ¿Tiene el sentimiento poder predictivo?" delay="0.15" />
          <StatAnalysis stats={data.statistical_analysis} />
        </section>
      )}

      {/* ── CLASSIFIER ── */}
      <section className="mb-8">
        <SectionTitle icon="⬤" label="Clasificador de Dirección (sube / baja)" delay="0.20" />
        {hasMultiModel ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card p-4 fade-in">
              <p className="text-xs uppercase tracking-widest text-muted mb-2">Accuracy comparada</p>
              <AccuracyBarMulti models={fairClf} />
            </div>
            <div className="lg:col-span-2">
              <ModelComparisonClf detail={data.classifier_detail} legacy={cls} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <KpiCard label="Accuracy"  baseline={cls.baseline.accuracy}  full={cls.full.accuracy}  format={fmtPct} delay="0.22" />
              <KpiCard label="Precision" baseline={cls.baseline.precision} full={cls.full.precision} format={fmtPct} delay="0.24" />
              <KpiCard label="Recall"    baseline={cls.baseline.recall}    full={cls.full.recall}    format={fmtPct} delay="0.26" />
              <KpiCard label="F1"        baseline={cls.baseline.f1}        full={cls.full.f1}        format={fmtPct} delay="0.28" />
            </div>
            <ModelComparisonClf detail={data.classifier_detail} legacy={cls} />
          </>
        )}
      </section>

      {/* ── REGRESSOR ── */}
      <section className="mb-8">
        <SectionTitle icon="◆" label="Regresor de Precio — Métricas en Test Set" delay="0.30" />
        <ModelComparisonReg detail={data.regression_detail} legacy={reg} />
      </section>

      {/* ── SENTIMENT SOURCES ── */}
      <section className="mb-8">
        <SectionTitle icon="◎" label="Fuentes de Sentimiento" delay="0.38" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Reddit */}
          <div className="glass-card p-4 fade-in">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: P.reddit }} />
              <p className="text-xs uppercase tracking-widest text-muted">Reddit · RoBERTa</p>
            </div>
            <p className="text-[10px] text-muted mb-2">
              {data.sentiment_coverage_pct}% cobertura · ≥5 posts/día
            </p>
            <SentimentChart data={data.sentiment_daily} />
          </div>

          {/* F&G */}
          {hasFG && (
            <div className="glass-card p-4 fade-in">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: P.fg }} />
                <p className="text-xs uppercase tracking-widest text-muted">Fear &amp; Greed Index</p>
              </div>
              <p className="text-[10px] text-muted mb-2">
                {data.fg_coverage_pct}% cobertura · Alternative.me
              </p>
              <FearGreedChart data={data.fg_daily} />
            </div>
          )}
        </div>

        {/* Reddit posts table */}
        <div className="glass-card p-4 fade-in">
          <p className="text-xs uppercase tracking-widest text-muted mb-3">Top posts Reddit por score</p>
          <RedditTable posts={data.reddit_posts} />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="text-center text-[10px] text-muted font-mono mt-10 pb-4 space-y-0.5">
        <p>Tesina · Licenciatura en Ciencias de Datos</p>
        <p>XGBoost + RoBERTa + Fear &amp; Greed Index (Alternative.me)</p>
        <p>Precios: Yahoo Finance 2024+ · Reddit r/Solana · Cron diario vía GitHub Actions</p>
        <p>Gráficos: Apache ECharts</p>
      </footer>
    </main>
  );
}
