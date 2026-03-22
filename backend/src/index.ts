/**
 * @file index.ts
 * @role Main entry point for Cloud Storage API server
 * @depends ElysiaJS, MongoDB/Mongoose
 * @dataflow HTTP Request → Elysia routes → Handlers → Response
 */

import { Elysia, t } from 'elysia'
import { edenTreaty } from '@elysiajs/eden'
import mongoose from 'mongoose'

/**
 * Health check endpoint
 */
const app = new Elysia()
  .get('/', () => ({
    message: 'Cloud Storage API',
    version: '0.0.1',
    status: 'healthy'
  }))
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }))

/**
 * Start server
 */
const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`🦊 Cloud Storage API running at http://localhost:${PORT}`)
})

/**
 * Export Eden Treaty for type-safe client
 */
export type App = typeof app
export const api = edenTreaty<App>('http://localhost:3001')
