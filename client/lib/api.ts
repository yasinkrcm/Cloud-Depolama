/**
 * @file api.ts
 * @role Eden Treaty API client with end-to-end type safety
 * @depends @elysiajs/eden
 * @dataflow Client → Eden Treaty → Backend Elysia routes
 */

import { edenTreaty } from '@elysiajs/eden'
import type { App } from '../../backend/src/index'

/**
 * Backend API base URL
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * Type-safe Eden Treaty client
 * Auto-generates types from backend Elysia app
 */
export const api = edenTreaty<App>(API_BASE_URL, {
  $fetch: {
    credentials: 'include'
  }
})

/**
 * API client type for extending
 */
export type ApiClient = typeof api
