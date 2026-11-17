export interface PollAnalysisRecord<T> {
  status: string
  analysis: T | null
  fallback?: boolean
}

export interface PollAnalysisOptions {
  intervalMs?: number
  timeoutMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export interface PollAnalysisResult<T> {
  status: 'ready' | 'error' | 'timeout'
  analysis: T | null
  fallback: boolean
}

export const ANALYSIS_POLL_INTERVAL_MS = 4_000
export const ANALYSIS_POLL_TIMEOUT_MS = 90_000

export async function pollAnalysis<T>(
  fetchOnce: () => Promise<PollAnalysisRecord<T>>,
  options: PollAnalysisOptions = {},
): Promise<PollAnalysisResult<T>> {
  const intervalMs = options.intervalMs ?? ANALYSIS_POLL_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? ANALYSIS_POLL_TIMEOUT_MS
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const now = options.now ?? Date.now
  const startedAt = now()

  let lastAnalysis: T | null = null

  while (true) {
    try {
      const record = await fetchOnce()
      if (record.status === 'ready') {
        return { status: 'ready', analysis: record.analysis, fallback: record.fallback ?? false }
      }
      if (record.status === 'error') {
        return { status: 'error', analysis: record.analysis ?? lastAnalysis, fallback: true }
      }
      lastAnalysis = record.analysis ?? lastAnalysis
    } catch {
      return { status: 'error', analysis: lastAnalysis, fallback: true }
    }

    if (now() - startedAt >= timeoutMs) {
      return { status: 'timeout', analysis: lastAnalysis, fallback: true }
    }
    await sleep(intervalMs)
  }
}
