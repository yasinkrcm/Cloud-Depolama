/**
 * @file utils.ts
 * @role Utility functions for client (shadcn/ui cn helper)
 * @depends clsx and tailwind-merge
 * @dataflow Class names → merged class string
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
