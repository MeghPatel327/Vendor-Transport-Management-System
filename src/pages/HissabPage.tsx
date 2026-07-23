import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hissabService } from '@/services/hissab.service'
import { formatDate, formatCurrency, formatNumber } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calculator, Search, Share2, FileText, Image as ImageIcon, Download, Copy, UserCheck, ArrowUpDown } from 'lucide-react'
import type { HissabEntry } from '@/types'

// Format Booking Date nicely (e.g. 20.07.2026)
function formatBookingDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

export default function HissabPage() {
  const [search, setSearch] = useState('')
  const [showLRNo, setShowLRNo] = useState(true)
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['hissab', { search }],
    queryFn: () => hissabService.getSummary({ search: search || undefined }),
    staleTime: 30_000,
  })

  const rawEntries = summary?.entries ?? []

  // Sort Pending 1st by default
  const sortedEntries = useMemo(() => {
    return [...rawEntries].sort((a, b) => {
      if (a.payment_status === 'Pending' && b.payment_status !== 'Pending') return -1
      if (a.payment_status !== 'Pending' && b.payment_status === 'Pending') return 1
      return 0
    })
  }, [rawEntries])

  // Segregate into Paid and Pending
  const pendingEntries = useMemo(() => sortedEntries.filter(e => e.payment_status === 'Pending'), [sortedEntries])
  const paidEntries = useMemo(() => sortedEntries.filter(e => e.payment_status === 'Paid'), [sortedEntries])

  const pendingTotal = useMemo(() => pendingEntries.reduce((s, e) => s + (e.amount || (e.quantity * e.rate)), 0), [pendingEntries])
  const paidTotal = useMemo(() => paidEntries.reduce((s, e) => s + (e.amount || (e.quantity * e.rate)), 0), [paidEntries])

  // Build exact text format requested by client for Hisab
  const buildHisabText = (entries: HissabEntry[], title: string, total: number) => {
    const header = `${title} HISAB\n\nLR NO\tBooking DT\tLot/Quantity\tAmount Total\n`
    const body = entries.map(e => {
      const lr = showLRNo ? e.lr_number : '***'
      const dt = formatBookingDate(e.booking_date)
      const amtStr = `${e.rate}*${e.quantity}`
      const amtTotal = e.amount || (e.rate * e.quantity)
      return `${lr}\t${dt}\t${e.quantity}\t${amtStr}\t${amtTotal}`
    }).join('\n')
    const footer = `\n\n\t\t\t Total - ${total}`
    return header + body + footer
  }

  // Build Employee LR details text format
  const buildEmployeeText = (entries: HissabEntry[]) => {
    const header = `PENDING LR DETAILS (FOR EMPLOYEE)\n\nLR NO\tBooking DT\tLot\n`
    const body = entries.map(e => {
      const lr = showLRNo ? e.lr_number : '***'
      const dt = formatBookingDate(e.booking_date)
      return `${lr}\t${dt}\t${e.quantity}`
    }).join('\n')
    return header + body
  }

  const handleCopyText = (entries: HissabEntry[], title: string, total: number) => {
    const text = buildHisabText(entries, title, total)
    navigator.clipboard.writeText(text)
    alert(`Copied ${title} Hisab text to clipboard!`)
  }

  const handleCopyEmployeeText = () => {
    const text = buildEmployeeText(pendingEntries)
    navigator.clipboard.writeText(text)
    alert('Copied Pending LR Details for Employee!')
  }

  const handlePrintPDF = (title: string) => {
    const content = printRef.current?.innerHTML || ''
    const win = window.open('', '', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>${title} Hisab</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background-color: #f3f4f6; }
            .total-row { font-weight: bold; font-size: 1.1em; background-color: #e5e7eb; }
          </style>
        </head>
        <body>
          <h2>${title} Hisab Report</h2>
          ${content}
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Hisab Statement
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Segregated Paid &amp; Pending Hisab reports with employee LR export
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Employee Export Button */}
          <Button
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => setEmployeeModalOpen(true)}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Extract Pending LR (For Employee)
          </Button>
        </div>
      </div>

      {/* Control Bar: Search & LR No Toggle */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="hissab-search"
              placeholder="Search by Transport Name or LR no…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* On/Off Switch for LR No. */}
          <div className="flex items-center space-x-3 bg-muted/30 px-3 py-1.5 rounded-lg border">
            <Switch id="lr-toggle" checked={showLRNo} onCheckedChange={setShowLRNo} />
            <Label htmlFor="lr-toggle" className="text-sm font-medium cursor-pointer">
              Show LR No. ({showLRNo ? 'ON' : 'OFF'})
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Segregated Paid & Pending Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pending" className="font-semibold text-amber-600">
            Pending Hisab ({pendingEntries.length})
          </TabsTrigger>
          <TabsTrigger value="paid" className="font-semibold text-emerald-600">
            Paid Hisab ({paidEntries.length})
          </TabsTrigger>
        </TabsList>

        {/* PENDING HISAB TAB */}
        <TabsContent value="pending" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm border-t-4 border-t-amber-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg text-amber-700">Pending Hisab Table</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleCopyText(pendingEntries, 'Pending', pendingTotal)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Text
                </Button>
                <Button size="sm" variant="outline" onClick={() => handlePrintPDF('Pending')}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> PDF / Print
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3 py-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : pendingEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No pending hissab entries</div>
              ) : (
                <div ref={printRef} className="overflow-x-auto">
                  <Table className="border-collapse">
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        {showLRNo && <TableHead className="font-bold">LR NO</TableHead>}
                        <TableHead className="font-bold">Booking DT</TableHead>
                        <TableHead className="font-bold">Transport Name</TableHead>
                        <TableHead className="font-bold">Lot/Quantity</TableHead>
                        <TableHead className="font-bold">Amount Calculation</TableHead>
                        <TableHead className="font-bold text-right">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingEntries.map(entry => {
                        const amtTotal = entry.amount || (entry.rate * entry.quantity)
                        return (
                          <TableRow key={entry.transport_id} className="hover:bg-amber-500/5">
                            {showLRNo && <TableCell className="font-mono font-bold text-amber-800">{entry.lr_number}</TableCell>}
                            <TableCell>{formatBookingDate(entry.booking_date)}</TableCell>
                            <TableCell className="font-medium">{entry.transport_name}</TableCell>
                            <TableCell className="font-mono">{entry.quantity}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{entry.rate}*{entry.quantity}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{amtTotal}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    <TableFooter className="bg-amber-500/10 font-bold text-base">
                      <TableRow>
                        <TableCell colSpan={showLRNo ? 5 : 4} className="text-right font-semibold">Total -</TableCell>
                        <TableCell className="text-right font-bold text-amber-800 font-mono">{pendingTotal}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAID HISAB TAB */}
        <TabsContent value="paid" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm border-t-4 border-t-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg text-emerald-700">Paid Hisab Table</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleCopyText(paidEntries, 'Paid', paidTotal)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Text
                </Button>
                <Button size="sm" variant="outline" onClick={() => handlePrintPDF('Paid')}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> PDF / Print
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3 py-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : paidEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No paid hissab entries</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="border-collapse">
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        {showLRNo && <TableHead className="font-bold">LR NO</TableHead>}
                        <TableHead className="font-bold">Booking DT</TableHead>
                        <TableHead className="font-bold">Transport Name</TableHead>
                        <TableHead className="font-bold">Lot/Quantity</TableHead>
                        <TableHead className="font-bold">Amount Calculation</TableHead>
                        <TableHead className="font-bold text-right">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidEntries.map(entry => {
                        const amtTotal = entry.amount || (entry.rate * entry.quantity)
                        return (
                          <TableRow key={entry.transport_id} className="hover:bg-emerald-500/5">
                            {showLRNo && <TableCell className="font-mono font-bold text-emerald-800">{entry.lr_number}</TableCell>}
                            <TableCell>{formatBookingDate(entry.booking_date)}</TableCell>
                            <TableCell className="font-medium">{entry.transport_name}</TableCell>
                            <TableCell className="font-mono">{entry.quantity}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{entry.rate}*{entry.quantity}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{amtTotal}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    <TableFooter className="bg-emerald-500/10 font-bold text-base">
                      <TableRow>
                        <TableCell colSpan={showLRNo ? 5 : 4} className="text-right font-semibold">Total -</TableCell>
                        <TableCell className="text-right font-bold text-emerald-800 font-mono">{paidTotal}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* EMPLOYEE PENDING LR DETAILS MODAL */}
      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" /> Pending LR Details for Employee
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Extract of pending LR entries containing only LR NO, Booking DT, and Lot for employee sharing (without amounts).
            </p>

            <div className="bg-slate-900 text-slate-100 font-mono text-sm p-4 rounded-lg overflow-x-auto max-h-[300px]">
              <div className="grid grid-cols-3 font-bold border-b border-slate-700 pb-2 mb-2">
                <span>LR NO</span>
                <span>Booking DT</span>
                <span>Lot</span>
              </div>
              {pendingEntries.map(e => (
                <div key={e.transport_id} className="grid grid-cols-3 py-1 border-b border-slate-800">
                  <span>{showLRNo ? e.lr_number : '***'}</span>
                  <span>{formatBookingDate(e.booking_date)}</span>
                  <span>{e.quantity}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button className="w-full" onClick={handleCopyEmployeeText}>
                <Copy className="h-4 w-4 mr-2" /> Copy Text for WhatsApp / Employee
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
