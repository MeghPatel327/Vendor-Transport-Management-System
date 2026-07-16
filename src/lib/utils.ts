import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

// ── Tailwind class merge ─────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Number formatting ────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

// ── Date formatting ──────────────────────────────────────────
export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateInput(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'yyyy-MM-dd')
  } catch {
    return dateStr
  }
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// ── Business calculations ────────────────────────────────────
export function calcAmount(quantity: number, rate: number): number {
  return Math.round(quantity * rate * 100) / 100
}

export function calcRemainingQuantity(quantity: number, dispatched: number): number {
  return Math.max(0, quantity - dispatched)
}

export function calcHissabAmount(dispatchedQty: number, rate: number): number {
  return Math.round(dispatchedQty * rate * 100) / 100
}

// ── String utilities ─────────────────────────────────────────
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Status color maps ────────────────────────────────────────
export const ORDER_STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800 border-amber-200',
  Received: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-rose-100 text-rose-800 border-rose-200',
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Partial: 'bg-blue-100 text-blue-800 border-blue-200',
}
