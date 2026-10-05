/**
 * Sparkline do card de índice: SVG inline (sem biblioteca de gráficos).
 * Série principal em `--chart-1`; benchmark (ou a linha de partida, quando não há benchmark) em cinza tracejado.
 */

interface SparklinePoint {
  date: string;
  points: number;
}

interface IndexSparklineProps {
  data: SparklinePoint[];
  /** Série de referência (ex.: IBOV) no mesmo período; normalizada para começar no mesmo nível do índice. */
  benchmark?: SparklinePoint[];
  height?: number;
  className?: string;
}

const WIDTH = 100;
const PADDING_Y = 2;

/** Converte a série em variação relativa ao primeiro ponto (fração). */
function toReturns(series: SparklinePoint[]): number[] {
  const first = series[0]?.points;
  if (!first) return [];
  return series.map((p) => p.points / first - 1);
}

function scaleY(value: number, min: number, max: number, height: number): number {
  const range = max - min || 1;
  return PADDING_Y + (1 - (value - min) / range) * (height - PADDING_Y * 2);
}

function toPolyline(values: number[], min: number, max: number, height: number): string {
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  return values.map((v, i) => `${(i * step).toFixed(2)},${scaleY(v, min, max, height).toFixed(2)}`).join(' ');
}

export function IndexSparkline({ data, benchmark, height = 40, className }: IndexSparklineProps) {
  const values = toReturns(data ?? []);

  if (values.length < 2) {
    return (
      <div style={{ height }} className="flex items-center text-xs text-muted-foreground">
        Sem histórico suficiente
      </div>
    );
  }

  const benchmarkValues = benchmark && benchmark.length > 1 ? toReturns(benchmark) : null;
  const all = [...values, ...(benchmarkValues ?? []), 0];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const baselineY = scaleY(0, min, max, height);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      role="img"
      aria-label={benchmarkValues ? 'Evolução recente do índice e do benchmark' : 'Evolução recente do índice'}
      className={className}
    >
      {benchmarkValues ? (
        <polyline
          points={toPolyline(benchmarkValues, min, max, height)}
          fill="none"
          stroke="var(--chart-2)"
          strokeWidth={1.25}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <line
          x1={0}
          x2={WIDTH}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--chart-2)"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={toPolyline(values, min, max, height)}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
