/**
 * @file backend/test/basic.test.ts
 * @role Basic test infrastructure for backend
 * @depends bun test runner
 * @dataflow Runs basic environment checks
 */
import { describe, it, expect } from 'bun:test'

describe('Backend basic tests', () => {
  it('should have environment', () => {
    expect(process.env.NODE_ENV).toBeDefined()
  })

  it('should support crypto.subtle for SHA-256', async () => {
    const message = new TextEncoder().encode('test')
    const hashBuffer = await crypto.subtle.digest('SHA-256', message)
    const hashHex = Buffer.from(hashBuffer).toString('hex')

    expect(hashHex).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')
  })

  it('should have Bun test utilities available', () => {
    expect(typeof describe).toBe('function')
    expect(typeof it).toBe('function')
    expect(typeof expect).toBe('function')
  })
})
