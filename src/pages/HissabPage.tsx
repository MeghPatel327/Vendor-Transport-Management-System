import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hissabService } from '@/services/hissab.service'
import { vendorsService } from '@/services/vendors.service'
import { transportService } from '@/services/transport.service'
import { formatDate, formatCurrency, formatNumber, PAYMENT_STATUS_COLORS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Calculator, TrendingUp, Truck } from 'lucide-react'

export default function HissabPage() {
  const [filterVendor, setFilterVendor] = useState('all')
  const [filterCity, setFilterCity] = useState('all')

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsService.getAll() })

  // Get all transport to extract unique cities
  const { data: allTransport = [] } = useQuery({
    queryKey: ['transport', {}],
    queryFn: () => transportService.getAll(),
  })
  const cities = [...new Set(allTransport.map(t => t.city).filter(Boolean))]

  const { data: summary, isLoading } = useQuery({
    queryKey: ['hissab', { vendor_id: filterVendor, city: filterCity }],
    queryFn: () => hissabService.getSummary({
      vendor_id: filterVendor !== 'all' ? Number(filterVendor) : undefined,
      city: filterCity !== 'all' ? filterCity : undefined,
    }),
    staleTime: 30_000,
  })

  const entries = summary?.entries ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" /> Hissab
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Financial summary — Dispatched Quantity × Rate
        </p>
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
                  <TableHead>Vendor</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Dispatched Qty</TableHead>
                  <TableHead className="text-right">Rate (₹)</TableHead>
                  <TableHead className="text-right">Hissab Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.transport_id}>
                    <TableCell className="font-mono text-sm">{entry.lr_number}</TableCell>
                    <TableCell className="font-medium">{entry.vendor_name}</TableCell>
                    <TableCell>{entry.city}</TableCell>
                    <TableCell>{entry.item}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(entry.dispatched_quantity)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(entry.rate)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(entry.hissab_amount)}</TableCell>
                    <TableCell><Badge className={PAYMENT_STATUS_COLORS[entry.payment_status]} variant="outline">{entry.payment_status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(entry.transport_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold bg-muted/30">
                  <TableCell colSpan={4}>Total</TableCell>
                  <TableCell className="text-right">{formatNumber(summary?.total_dispatched_quantity ?? 0)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-emerald-700">{formatCurrency(summary?.total_hissab_amount ?? 0)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
