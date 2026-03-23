/**
 * @file error-handler.ts
 * @role Global error handling and reporting utilities
 * @depends None
 * @dataflow Error → Log → Report to external service (optional)
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error report interface
 */
interface ErrorReport {
  message: string
  stack?: string | undefined
  severity: ErrorSeverity
  context?: Record<string, unknown> | undefined
  timestamp: Date
  userAgent?: string | undefined
  url?: string | undefined
}

/**
 * Safely stringify an error object
 */
function safeStringify(error: unknown): string {
  if (error === null || error === undefined) {
    return 'null or undefined error'
  }

  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message || error.name || 'Unknown Error'
  }

  if (typeof error === 'object') {
    try {
      // Check for message property
      if ('message' in error && typeof error.message === 'string') {
        return error.message
      }
      // Check for other common properties
      if ('error' in error && typeof error.error === 'string') {
        return error.error
      }
      // Stringify the object
      return JSON.stringify(error)
    } catch {
      return '[object Object]'
    }
  }

  return String(error)
}

/**
 * Log error to console and optionally send to external service
 */
export function reportError(error: Error | unknown, severity: ErrorSeverity = ErrorSeverity.MEDIUM, context?: Record<string, unknown>): void {
  const message = safeStringify(error)
  const errorObj = error instanceof Error ? error : null

  const errorReport: ErrorReport = {
    message,
    stack: errorObj?.stack,
    severity,
    context,
    timestamp: new Date(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  }

  // Log to console with proper formatting
  const logMethod = severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL
    ? console.error
    : severity === ErrorSeverity.MEDIUM
      ? console.warn
      : console.log

  logMethod('❌ Error:', message)
  if (context) {
    logMethod('   Context:', context)
  }
  if (errorReport.stack) {
    logMethod('   Stack:', errorReport.stack)
  }

  // TODO: Send to external error tracking service (Sentry, LogRocket, etc.)
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn()
    } catch (error) {
      reportError(error, severity, { function: fn.name, args })
      throw error
    }
  }) as T
}

/**
 * Create a retry wrapper for async functions
 */
export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    maxRetries?: number
    delayMs?: number
    backoff?: boolean
    severity?: ErrorSeverity
  } = {}
): T {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoff = true,
    severity = ErrorSeverity.MEDIUM
  } = options

  return (async (...args: Parameters<T>) => {
    let lastError: Error | unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args)
      } catch (error) {
        lastError = error

        if (attempt < maxRetries) {
          const delay = backoff ? delayMs * Math.pow(2, attempt) : delayMs
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    reportError(lastError, severity, {
      function: fn.name,
      attempts: maxRetries + 1
    })

    throw lastError
  }) as T
}
