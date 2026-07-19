import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hissabService } from '@/services/hissab.service'
import { vendorsService } from '@/services/vendors.service'
import { transportService } from '@/services/transport.service'
import { formatDate, formatCurrency, formatNumber, PAYMENT_STATUS_COLORS } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Calculator, TrendingUp, Truck, Download, Search, Share2 } from 'lucide-react'
import type { HissabEntry, HissabSummary } from '@/types'

// ── Export CSV (no rate, no amount) ──────────────────────────────────────────
function exportToCSV(entries: HissabEntry[], summary: HissabSummary | undefined) {
  const headers = ['LR No.', 'Transport Name', 'Vendor', 'City', 'Item', 'Dispatched Qty', 'Payment Status', 'Date']
  const rows = entries.map(e => [
    e.lr_number,
    e.transport_name,
    e.vendor_name,
    e.city,
    e.item,
    e.dispatched_quantity,
    e.payment_status,
    e.transport_date ? e.transport_date.split('T')[0] : '',
  ])

  // Totals row (no amount)
  rows.push(['TOTAL', '', '', '', '', summary?.total_dispatched_quantity ?? 0, '', ''])

  const escape = (val: any) => {
    const s = String(val ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hissab-export-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Share helper (no amount, no rate) ────────────────────────────────────────
function buildShareText(entries: HissabEntry[], summary: HissabSummary | undefined): string {
  const lines = [
    '📊 Hissab Summary',
    `Total Entries: ${entries.length}`,
    `Total Dispatched Qty: ${formatNumber(summary?.total_dispatched_quantity ?? 0)}`,
    '',
    'Details:',
    ...entries.map(e =>
      `• LR ${e.lr_number} | ${e.transport_name} | ${e.city} | ${e.item} | Dispatched: ${formatNumber(e.dispatched_quantity)} | ${e.payment_status}`
    ),
  ]
  return lines.join('\n')
}

function shareEntry(entry: HissabEntry) {
  const text = [
    `📦 LR No: ${entry.lr_number}`,
    `🚛 Transport: ${entry.transport_name}`,
    `👤 Vendor: ${entry.vendor_name}`,
    `📍 City: ${entry.city}`,
    `📦 Item: ${entry.item}`,
    `Dispatched Qty: ${formatNumber(entry.dispatched_quantity)}`,
    `Status: ${entry.payment_status}`,
    `Date: ${formatDate(entry.transport_date)}`,
  ].join('\n')

  if (navigator.share) {
    navigator.share({ title: `Hissab — LR ${entry.lr_number}`, text }).catch(() => {})
  } else {
    navigator.clipboard.writeText(text).catch(() => {})
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HissabPage() {
  const [filterVendor, setFilterVendor] = useState('all')
  const [filterCity, setFilterCity] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [search, setSearch] = useState('')

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsService.getAll() })

  const { data: allTransport = [] } = useQuery({
    queryKey: ['transport', {}],
    queryFn: () => transportService.getAll(),
  })
  const cities = [...new Set(allTransport.map(t => t.city).filter(Boolean))]

  const { data: summary, isLoading } = useQuery({
    queryKey: ['hissab', { vendor_id: filterVendor, city: filterCity, search, payment_status: filterPayment }],
    queryFn: () => hissabService.getSummary({
      vendor_id: filterVendor !== 'all' ? Number(filterVendor) : undefined,
      city: filterCity !== 'all' ? filterCity : undefined,
      search: search || undefined,
      payment_status: filterPayment !== 'all' ? filterPayment as any : undefined,
    }),
    staleTime: 30_000,
  })

  const entries = summary?.entries ?? []

  const handleShareAll = () => {
    const text = buildShareText(entries, summary)
    if (navigator.share) {
      navigator.share({ title: 'Hissab Summary', text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Hissab
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Financial summary — Dispatched Quantity × Rate</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleShareAll}
            disabled={entries.length === 0}
            id="hissab-share-btn"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button
            variant="outline"
            onClick={() => exportToCSV(entries, summary)}
            disabled={entries.length === 0}
            id="hissab-export-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Calculator className="h-6 w-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Hissab Amount</p>
              <p className="text-2xl font-bold text-emerald-600">
                {isLoading ? <Skeleton className="h-7 w-32 inline-block" /> : formatCurrency(summary?.total_hissab_amount ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><TrendingUp className="h-6 w-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Dispatched Qty</p>
              <p className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-7 w-24 inline-block" /> : formatNumber(summary?.total_dispatched_quantity ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><Truck className="h-6 w-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Entries</p>
              <p className="text-2xl font-bold">{entries.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="hissab-search"
            placeholder="Search transport name or LR…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterVendor} onValueChange={setFilterVendor}>
          <SelectTrigger className="w-[180px]" id="hissab-filter-vendor">
            <SelectValue placeholder="All vendors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {cities.length > 0 && (
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[150px]" id="hissab-filter-city">
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-[150px]" id="hissab-filter-payment">
            <SelectValue placeholder="Payment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Partial">Partial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Calculator className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium text-muted-foreground">No hissab entries found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Hissab is computed from transport dispatch data</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>LR No.</TableHead>
                  <TableHead>Transport Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Dispatched Qty</TableHead>
                  <TableHead className="text-right">Hissab Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.transport_id}>
                    <TableCell className="font-mono text-sm">{entry.lr_number}</TableCell>
                    <TableCell className="font-medium">{entry.transport_name}</TableCell>
                    <TableCell>{entry.vendor_name}</TableCell>
                    <TableCell>{entry.city}</TableCell>
                    <TableCell>{entry.item}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(entry.dispatched_quantity)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(entry.hissab_amount)}</TableCell>
                    <TableCell>
                      <Badge className={PAYMENT_STATUS_COLORS[entry.payment_status]} variant="outline">
                        {entry.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(entry.transport_date)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Share entry (without amounts)"
                        onClick={() => shareEntry(entry)}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold bg-muted/30">
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right">{formatNumber(summary?.total_dispatched_quantity ?? 0)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatCurrency(summary?.total_hissab_amount ?? 0)}</TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
