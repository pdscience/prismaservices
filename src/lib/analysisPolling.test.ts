import { describe, it, expect, vi } from 'vitest'
import { pollAnalysis } from './analysisPolling'

function clocked() {
  let clock = 0
  return {
    now: () => clock,
    sleep: async (ms: number) => { clock += ms },
  }
}

describe('pollAnalysis', () => {
  it('devolve ready imediatamente quando a primeira consulta já está pronta', async () => {
    const fetchOnce = vi.fn().mockResolvedValue({
      status: 'ready',
      analysis: { summary: 'ok' },
      fallback: false,
    })
    const result = await pollAnalysis(fetchOnce, { sleep: async () => {} })
    expect(result.status).toBe('ready')
    expect(result.analysis).toEqual({ summary: 'ok' })
    expect(fetchOnce).toHaveBeenCalledTimes(1)
  })

  it('continua consultando enquanto estiver em processamento', async () => {
    const fetchOnce = vi
      .fn()
      .mockResolvedValueOnce({ status: 'processing', analysis: null })
      .mockResolvedValueOnce({ status: 'working', analysis: null })
      .mockResolvedValueOnce({ status: 'ready', analysis: { summary: 'ok' }, fallback: false })
    const result = await pollAnalysis(fetchOnce, { sleep: async () => {} })
    expect(result.status).toBe('ready')
    expect(result.analysis).toEqual({ summary: 'ok' })
    expect(fetchOnce).toHaveBeenCalledTimes(3)
  })

  it('para imediatamente quando o status é error', async () => {
    const fetchOnce = vi.fn().mockResolvedValue({ status: 'error', analysis: null })
    const result = await pollAnalysis(fetchOnce, { sleep: async () => {} })
    expect(result.status).toBe('error')
    expect(fetchOnce).toHaveBeenCalledTimes(1)
  })

  it('devolve timeout quando o tempo limite é atingido', async () => {
    const { now, sleep } = clocked()
    const fetchOnce = vi.fn().mockResolvedValue({ status: 'processing', analysis: null })
    const result = await pollAnalysis(fetchOnce, {
      intervalMs: 4_000,
      timeoutMs: 10_000,
      sleep,
      now,
    })
    expect(result.status).toBe('timeout')
    expect(result.fallback).toBe(true)
  })

  it('devolve error quando a consulta lança exceção', async () => {
    const fetchOnce = vi.fn().mockRejectedValue(new Error('offline'))
    const result = await pollAnalysis(fetchOnce, { sleep: async () => {} })
    expect(result.status).toBe('error')
    expect(result.fallback).toBe(true)
  })
})
