/**
 * @file env.ts
 * @role Centralized environment configuration with fail-safe validation
 * @depends Bun
 * @dataflow process.env → validated config exports used by server modules
 */

/**
 * Resolve the JWT signing secret.
 * Development: generates an ephemeral secret and warns (sessions reset on restart).
 * Production: refuses to boot without an explicitly configured secret.
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production')
  }

  console.warn('⚠️  JWT_SECRET is not set — using an ephemeral generated secret (development only)')
  return crypto.randomUUID().repeat(2)
}

/**
 * JWT signing secret (fail-safe: see resolveJwtSecret)
 */
export const JWT_SECRET = resolveJwtSecret()

/**
 * CORS / CSRF allowlist origins (comma-separated ALLOWED_ORIGINS env var)
 */
export const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
