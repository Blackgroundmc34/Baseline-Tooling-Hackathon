declare module 'compute-baseline' {
  export function getStatus(
    featureId?: string,
    bcdKey?: string
  ): Promise<{
    baseline: 'high' | 'low' | false;
    baseline_low_date?: string;
    baseline_high_date?: string;
    support?: Record<string, string | boolean>;
  }>;
}
