import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QueryResult } from '../../types/connection';
import { BarChart3 } from 'lucide-react';

interface ResultChartProps {
  result: QueryResult;
}

const MAX_BARS = 50;
const BAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

function isNumericColumn(rows: Record<string, unknown>[], col: string): boolean {
  let seen = 0;
  for (const row of rows) {
    const v = row[col];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number') { seen++; continue; }
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) { seen++; continue; }
    return false;
  }
  return seen > 0;
}

export function ResultChart({ result }: ResultChartProps) {
  const { t } = useTranslation();

  const numericCols = useMemo(
    () => result.columns.filter((c) => isNumericColumn(result.rows, c)),
    [result]
  );
  const labelCols = useMemo(
    () => result.columns.filter((c) => !numericCols.includes(c)),
    [result.columns, numericCols]
  );

  const [labelCol, setLabelCol] = useState<string | null>(null);
  const [valueCol, setValueCol] = useState<string | null>(null);

  const effectiveLabel = labelCol && labelCols.includes(labelCol) ? labelCol : labelCols[0];
  const effectiveValue = valueCol && numericCols.includes(valueCol) ? valueCol : numericCols[0];

  if (!result.rows.length || numericCols.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <BarChart3 size={28} />
        <p className="text-xs">{t('chart.noNumeric')}</p>
      </div>
    );
  }

  const data = result.rows.slice(0, MAX_BARS).map((row, i) => ({
    label: effectiveLabel ? String(row[effectiveLabel] ?? '') : String(i + 1),
    value: Number(row[effectiveValue]) || 0,
  }));

  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1e-9);
  const hasNegative = data.some((d) => d.value < 0);

  // Layout
  const chartWidth = Math.max(data.length * 56, 320);
  const chartHeight = 260;
  const padTop = 20;
  const padBottom = 40;
  const padLeft = 12;
  const padRight = 12;
  const plotH = chartHeight - padTop - padBottom;
  const baseline = hasNegative
    ? padTop + (plotH * maxVal) / (2 * maxVal)
    : padTop + plotH;
  const barW = Math.min(36, (chartWidth - padLeft - padRight) / data.length - 12);

  return (
    <div className="h-full flex flex-col">
      {/* Column pickers */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border text-xs flex-shrink-0">
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t('chart.labelAxis')}</span>
          <select
            value={effectiveLabel || ''}
            onChange={(e) => setLabelCol(e.target.value)}
            className="px-1.5 py-0.5 rounded border border-border bg-background text-foreground text-xs focus:outline-none"
          >
            {labelCols.length === 0 && <option value="">{t('chart.rowIndex')}</option>}
            {labelCols.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t('chart.valueAxis')}</span>
          <select
            value={effectiveValue || ''}
            onChange={(e) => setValueCol(e.target.value)}
            className="px-1.5 py-0.5 rounded border border-border bg-background text-foreground text-xs focus:outline-none"
          >
            {numericCols.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        {result.rows.length > MAX_BARS && (
          <span className="text-muted-foreground ml-auto">{t('chart.truncated', { count: MAX_BARS })}</span>
        )}
      </div>

      {/* SVG chart */}
      <div className="flex-1 overflow-auto p-3">
        <svg width={chartWidth} height={chartHeight} className="min-w-full">
          {/* grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = padTop + plotH * f;
            return (
              <g key={f}>
                <line x1={padLeft} x2={chartWidth - padRight} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />
                <text x={padLeft} y={y - 3} fontSize={9} fill="currentColor" opacity={0.4}>
                  {formatTick(hasNegative ? maxVal - 2 * maxVal * f : maxVal - maxVal * f)}
                </text>
              </g>
            );
          })}
          {/* baseline */}
          <line x1={padLeft} x2={chartWidth - padRight} y1={baseline} y2={baseline} stroke="currentColor" strokeOpacity={0.25} />
          {/* bars */}
          {data.map((d, i) => {
            const slotW = (chartWidth - padLeft - padRight) / data.length;
            const x = padLeft + slotW * i + (slotW - barW) / 2;
            const h = (Math.abs(d.value) / (hasNegative ? 2 * maxVal : maxVal)) * plotH;
            const y = d.value >= 0 ? baseline - h : baseline;
            const color = BAR_COLORS[i % BAR_COLORS.length];
            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx={2} fill={color}>
                  <title>{`${d.label}: ${d.value}`}</title>
                </rect>
                <text
                  x={x + barW / 2}
                  y={d.value >= 0 ? y - 4 : y + h + 10}
                  fontSize={9}
                  textAnchor="middle"
                  fill="currentColor"
                  opacity={0.7}
                >
                  {formatTick(d.value)}
                </text>
                <text
                  x={x + barW / 2}
                  y={chartHeight - padBottom + 14}
                  fontSize={9}
                  textAnchor="middle"
                  fill="currentColor"
                  opacity={0.6}
                >
                  {truncate(d.label, 8)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
