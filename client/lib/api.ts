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

/**
 * Generic Eden Treaty call result contract used by the auth UI
 */
export interface AuthCallResult<T> {
  data?: T
  error?: { value?: { error?: string } }
}

/**
 * Auth response payload from the backend
 */
export interface AuthResponse {
  success: boolean
  user?: { email: string }
  error?: string
}

/**
 * Typed treaty fallback for the auth UI. The full App generic degrades to {}
 * during cross-package type composition, so callers need a stable contract.
 */
export interface AuthApiClient {
  api: {
    auth: {
      login: { post: (body: { email: string; password: string }) => Promise<AuthCallResult<AuthResponse>> }
      register: { post: (body: { email: string; password: string }) => Promise<AuthCallResult<AuthResponse>> }
      me: { get: () => Promise<AuthCallResult<AuthResponse>> }
      'setup-status': { get: () => Promise<AuthCallResult<{ hasUser: boolean }>> }
    }
  }
}

/**
 * Auth-focused, type-safe API client
 */
export const authApi = api as unknown as AuthApiClient
