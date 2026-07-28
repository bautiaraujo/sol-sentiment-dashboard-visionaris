"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

/* Sólo registramos lo que usa el dashboard: baja bastante el bundle frente
   al paquete completo de ECharts. Si agregás un tipo de gráfico nuevo,
   acordate de registrarlo acá también. */
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

/**
 * Wrapper mínimo sobre Apache ECharts.
 * - Crea la instancia una vez y la reutiliza.
 * - Re-aplica la opción cuando cambia (por ej. al cambiar de tema).
 * - Se redimensiona con ResizeObserver.
 */
export function EChart({
  option,
  height = 300,
  className = "",
}: {
  option: EChartsOption;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current);

    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);

    return () => {
      ro.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={className} style={{ width: "100%", height }} />;
}
