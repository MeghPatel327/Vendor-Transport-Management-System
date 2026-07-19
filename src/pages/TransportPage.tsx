import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { transportService } from '@/services/transport.service'
import { vendorsService } from '@/services/vendors.service'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatCurrency, formatNumber, PAYMENT_STATUS_COLORS, todayISO } from '@/lib/utils'
import type { Transport, PaymentStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Pencil, Trash2, Truck, ChevronDown, ChevronRight, Package, Share2, X } from 'lucide-react'

// ── Schemas ──────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  item: z.string().min(1, 'Item is required'),
  quantity: z.coerce.number().positive('Must be positive'),
  dispatched_quantity: z.coerce.number().min(0, 'Cannot be negative'),
  rate: z.coerce.number().positive('Must be positive'),
})

const transportSchema = z.object({
  vendor_id: z.coerce.number().min(1, 'Select a vendor'),
  lr_number: z.string().min(1, 'LR number is required'),
  transport_name: z.string().min(1, 'Transport name is required'),
  city: z.string().min(1, 'City is required'),
  payment_status: z.enum(['Pending', 'Paid', 'Partial']),
  transport_date: z.string().min(1, 'Date is required'),
  items: z.array(itemSchema).min(1, 'At least one item required'),
})

type TransportForm = z.infer<typeof transportSchema>

// ── Per-item live amount preview ──────────────────────────────────────────────
function ItemAmountPreview({ control, index }: { control: any; index: number }) {
  const quantity = useWatch({ control, name: `items.${index}.quantity` })
  const rate = useWatch({ control, name: `items.${index}.rate` })
  const dispatched = useWatch({ control, name: `items.${index}.dispatched_quantity` })
  const amount = (Number(quantity) || 0) * (Number(rate) || 0)
  const hissab = (Number(dispatched) || 0) * (Number(rate) || 0)
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span>Amount: <strong className="text-foreground">{formatCurrency(amount)}</strong></span>
      <span>Hissab: <strong className="text-emerald-600">{formatCurrency(hissab)}</strong></span>
    </div>
  )
}

// ── LR Group type ─────────────────────────────────────────────────────────────
interface LRGroup {
  lr_number: string
  transport_name: string
  city: string
  transport_date: string
  payment_status: PaymentStatus
  vendor_name: string
  vendor_id: number
  items: Transport[]
  totalItems: number
  totalAmount: number
  totalDispatched: number
  totalQuantity: number
}

// ── Share helper ──────────────────────────────────────────────────────────────
function buildShareText(group: LRGroup): string {
  return [
    `📦 LR No: ${group.lr_number}`,
    `🚛 Transport: ${group.transport_name}`,
    `📍 City: ${group.city}`,
    `👤 Vendor: ${group.vendor_name}`,
    `📅 Date: ${formatDate(group.transport_date)}`,
    `Status: ${group.payment_status}`,
    '',
    'Items:',
    ...group.items.map(t =>
      `  • ${t.item} — Qty: ${formatNumber(t.quantity)}, Dispatched: ${formatNumber(t.dispatched_quantity)}`
    ),
    '',
    `Total Items: ${group.totalItems}`,
    `Total Qty: ${formatNumber(group.totalQuantity)}`,
  ].join('\n')
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TransportPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [filterVendor, setFilterVendor] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [filterCity, setFilterCity] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<Transport | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<Transport | null>(null)
  const [expandedLRs, setExpandedLRs] = useState<Set<string>>(new Set())

  const { data: transport = [], isLoading } = useQuery({
    queryKey: ['transport', { search, vendor_id: filterVendor, payment_status: filterPayment, city: filterCity }],
    queryFn: () => transportService.getAll({
      search,
      vendor_id: filterVendor !== 'all' ? Number(filterVendor) : undefined,
      payment_status: filterPayment !== 'all' ? filterPayment as PaymentStatus : undefined,
      city: filterCity !== 'all' ? filterCity : undefined,
    }),
    staleTime: 30_000,
  })

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsService.getAll() })

  const cities = useMemo(() => [...new Set(transport.map(t => t.city).filter(Boolean))], [transport])
  // Collect unique item names from all transport for the datalist
  const uniqueItems = useMemo(() => [...new Set(transport.map(t => t.item).filter(Boolean))].sort(), [transport])

  // Group by lr_number
  const lrGroups = useMemo<LRGroup[]>(() => {
    const map = new Map<string, Transport[]>()
    for (const t of transport) {
      if (!map.has(t.lr_number)) map.set(t.lr_number, [])
      map.get(t.lr_number)!.push(t)
    }
    return Array.from(map.entries()).map(([lr_number, items]) => ({
      lr_number,
      transport_name: items[0].transport_name,
      city: items[0].city,
      transport_date: items[0].transport_date,
      payment_status: items[0].payment_status,
      vendor_name: items[0].vendor_name ?? '',
      vendor_id: items[0].vendor_id,
      items,
      totalItems: items.length,
      totalAmount: items.reduce((s, i) => s + i.amount, 0),
      totalDispatched: items.reduce((s, i) => s + i.dispatched_quantity, 0),
      totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    }))
  }, [transport])

  const toggleLR = (lr: string) => {
    setExpandedLRs(prev => {
      const next = new Set(prev)
      if (next.has(lr)) next.delete(lr); else next.add(lr)
      return next
    })
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  const form = useForm<TransportForm>({
    resolver: zodResolver(transportSchema),
    defaultValues: {
      payment_status: 'Pending',
      transport_date: todayISO(),
      items: [{ item: '', quantity: 0, dispatched_quantity: 0, rate: 0 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: transportService.create,
    onError: () => toast({ title: 'Error', description: 'Failed to create entry.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => transportService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport'] })
      toast({ title: 'Transport entry updated' } as any)
      setDialogOpen(false); setEditEntry(null); form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update entry.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: transportService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast({ title: 'Transport entry deleted' } as any); setDeleteEntry(null)
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete entry.', variant: 'destructive' }),
  })

  const isMutating = createMutation.isPending || updateMutation.isPending

  // ── Dialog openers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditEntry(null)
    form.reset({
      payment_status: 'Pending', transport_date: todayISO(),
      items: [{ item: '', quantity: 0, dispatched_quantity: 0, rate: 0 }],
    })
    setDialogOpen(true)
  }

  const openEdit = (t: Transport) => {
    setEditEntry(t)
    form.reset({
      vendor_id: t.vendor_id, lr_number: t.lr_number, transport_name: t.transport_name,
      city: t.city, payment_status: t.payment_status, transport_date: t.transport_date.split('T')[0],
      items: [{ item: t.item, quantity: t.quantity, dispatched_quantity: t.dispatched_quantity, rate: t.rate }],
    })
    setDialogOpen(true)
  }

  const handlePendingClick = (t: Transport) => {
    updateMutation.mutate({ id: t.id, data: { payment_status: 'Paid' } })
  }

  const onSubmit = async (data: TransportForm) => {
    if (editEntry) {
      // Edit single item
      const it = data.items[0]
      updateMutation.mutate({
        id: editEntry.id,
        data: { vendor_id: data.vendor_id, lr_number: data.lr_number, transport_name: data.transport_name, city: data.city, payment_status: data.payment_status, transport_date: data.transport_date, item: it.item, quantity: it.quantity, dispatched_quantity: it.dispatched_quantity, rate: it.rate },
      })
    } else {
      // Create one entry per item, all under same LR
      try {
        for (const it of data.items) {
          await createMutation.mutateAsync({
            vendor_id: data.vendor_id, lr_number: data.lr_number, transport_name: data.transport_name,
            city: data.city, payment_status: data.payment_status, transport_date: data.transport_date,
            item: it.item, quantity: it.quantity, dispatched_quantity: it.dispatched_quantity, rate: it.rate,
          })
        }
        queryClient.invalidateQueries({ queryKey: ['transport'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        toast({ title: `${data.items.length} item(s) added under LR ${data.lr_number}` } as any)
        setDialogOpen(false); form.reset()
      } catch { /* handled by mutation onError */ }
    }
  }

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = useCallback((group: LRGroup) => {
    const text = buildShareText(group)
    if (navigator.share) {
      navigator.share({ title: `Transport LR ${group.lr_number}`, text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    toast({ title: '📋 Copied!', description: 'Transport details copied (no amounts)' } as any)
  }, [toast])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" /> Transport
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage dispatch &amp; transport entries</p>
        </div>
        <Button onClick={openAdd} id="add-transport-btn"><Plus className="h-4 w-4" /> Add Entry</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total LR Numbers', value: lrGroups.length },
          { label: 'Pending Payment', value: transport.filter(t => t.payment_status === 'Pending').length },
          { label: 'Total Amount', value: formatCurrency(transport.reduce((s, t) => s + t.amount, 0)) },
          { label: 'Total Dispatched', value: formatNumber(transport.reduce((s, t) => s + t.dispatched_quantity, 0)) },
        ].map(({ label, value }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="transport-search" placeholder="Search LR or transport name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterVendor} onValueChange={setFilterVendor}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All vendors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {cities.length > 0 && (
              <Select value={filterCity} onValueChange={setFilterCity}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All cities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Payment status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : lrGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Truck className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium text-muted-foreground">No transport entries found</p>
              <Button className="mt-4" onClick={openAdd} variant="outline"><Plus className="h-4 w-4" /> Add Entry</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>LR No.</TableHead>
                    <TableHead>Transport Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lrGroups.map(group => {
                    const isExpanded = expandedLRs.has(group.lr_number)
                    return (
                      <>
                        {/* ── LR Group row ── */}
                        <TableRow
                          key={`grp-${group.lr_number}`}
                          className="cursor-pointer hover:bg-muted/50 bg-muted/20 font-medium"
                          onClick={() => toggleLR(group.lr_number)}
                        >
                          <TableCell className="pr-0">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold text-primary">{group.lr_number}</TableCell>
                          <TableCell>{group.transport_name}</TableCell>
                          <TableCell>{group.city}</TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1 text-sm">
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              {group.totalItems} {group.totalItems === 1 ? 'item' : 'items'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(group.totalQuantity)}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            {group.payment_status === 'Pending' ? (
                              <Badge
                                className={`${PAYMENT_STATUS_COLORS[group.payment_status]} cursor-pointer hover:opacity-70 transition-opacity`}
                                variant="outline"
                                title="Click to mark as Paid"
                                onClick={() => handlePendingClick(group.items[0])}
                              >
                                {group.payment_status}
                              </Badge>
                            ) : (
                              <Badge className={PAYMENT_STATUS_COLORS[group.payment_status]} variant="outline">
                                {group.payment_status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(group.transport_date)}</TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              title="Share (without amounts)"
                              onClick={() => handleShare(group)}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* ── Expanded item rows ── */}
                        {isExpanded && group.items.map(t => (
                          <TableRow key={`itm-${t.id}`} className="bg-background hover:bg-muted/30 border-l-2 border-l-primary/20">
                            <TableCell />
                            <TableCell className="text-muted-foreground text-xs pl-6">└</TableCell>
                            <TableCell colSpan={2}>
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="font-medium text-sm">{t.item}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-xs space-y-0.5">
                                <div className="text-muted-foreground">Qty: <span className="font-mono font-medium">{formatNumber(t.quantity)}</span></div>
                                <div className="text-emerald-600">Dispatched: <span className="font-mono">{formatNumber(t.dispatched_quantity)}</span></div>
                                <div className="text-amber-600">Remaining: <span className="font-mono">{formatNumber(t.remaining_quantity)}</span></div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-xs space-y-0.5">
                                <div className="text-muted-foreground">Rate: <span className="font-mono">{formatCurrency(t.rate)}</span></div>
                                <div className="font-bold text-sm">{formatCurrency(t.amount)}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {t.payment_status === 'Pending' ? (
                                <Badge
                                  className={`${PAYMENT_STATUS_COLORS[t.payment_status]} cursor-pointer hover:opacity-70 transition-opacity text-xs`}
                                  variant="outline"
                                  title="Click to mark as Paid"
                                  onClick={() => handlePendingClick(t)}
                                >
                                  {t.payment_status}
                                </Badge>
                              ) : (
                                <Badge className={`${PAYMENT_STATUS_COLORS[t.payment_status]} text-xs`} variant="outline">
                                  {t.payment_status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{formatDate(t.transport_date)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteEntry(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Edit Transport Entry' : 'New Transport Entry'}</DialogTitle>
          </DialogHeader>

          {/* Datalist for item name autocomplete */}
          <datalist id="items-datalist">
            {uniqueItems.map(name => <option key={name} value={name} />)}
          </datalist>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Vendor *</Label>
                <Select value={String(form.watch('vendor_id') || '')} onValueChange={v => form.setValue('vendor_id', Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
                {form.formState.errors.vendor_id && <p className="text-sm text-destructive">{form.formState.errors.vendor_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-lr">LR Number *</Label>
                <Input id="t-lr" placeholder="e.g. LR-2024-001" {...form.register('lr_number')} disabled={isMutating} />
                {form.formState.errors.lr_number && <p className="text-sm text-destructive">{form.formState.errors.lr_number.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-tname">Transport Name *</Label>
                <Input id="t-tname" placeholder="e.g. Gati Logistics" {...form.register('transport_name')} disabled={isMutating} />
                {form.formState.errors.transport_name && <p className="text-sm text-destructive">{form.formState.errors.transport_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-city">City *</Label>
                <Input id="t-city" placeholder="e.g. Mumbai" {...form.register('city')} disabled={isMutating} />
                {form.formState.errors.city && <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={form.watch('payment_status')} onValueChange={v => form.setValue('payment_status', v as PaymentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="t-date">Transport Date *</Label>
                <Input id="t-date" type="date" {...form.register('transport_date')} disabled={isMutating} />
              </div>
            </div>

            {/* Items section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Items {fields.length > 1 && <span className="ml-1 text-sm font-normal text-muted-foreground">({fields.length} items, Total qty: {fields.reduce((s, _, i) => s + (Number(form.watch(`items.${i}.quantity`)) || 0), 0)})</span>}
                </Label>
                {!editEntry && (
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => append({ item: '', quantity: 0, dispatched_quantity: 0, rate: 0 })}
                    disabled={isMutating}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-3 relative bg-muted/10">
                    {/* Item header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Item {index + 1}
                      </span>
                      {!editEntry && fields.length > 1 && (
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Item name with datalist autocomplete */}
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Item Name *</Label>
                        <Input
                          placeholder="Type or select item…"
                          list="items-datalist"
                          {...form.register(`items.${index}.item`)}
                          disabled={isMutating}
                        />
                        {form.formState.errors.items?.[index]?.item && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.item?.message}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Total Quantity *</Label>
                        <Input type="number" min="0" step="any" placeholder="0" {...form.register(`items.${index}.quantity`)} disabled={isMutating} />
                        {form.formState.errors.items?.[index]?.quantity && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.quantity?.message}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Dispatched Qty</Label>
                        <Input type="number" min="0" step="any" placeholder="0" {...form.register(`items.${index}.dispatched_quantity`)} disabled={isMutating} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rate (₹) *</Label>
                        <Input type="number" min="0" step="any" placeholder="0.00" {...form.register(`items.${index}.rate`)} disabled={isMutating} />
                        {form.formState.errors.items?.[index]?.rate && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.rate?.message}</p>
                        )}
                      </div>
                      <div className="flex items-end">
                        <ItemAmountPreview control={form.control} index={index} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isMutating}>Cancel</Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? 'Saving…' : editEntry ? 'Save Changes' : `Add ${fields.length > 1 ? `${fields.length} Items` : 'Entry'}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteEntry} onOpenChange={open => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transport Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteEntry?.item}</strong> under LR <strong>{deleteEntry?.lr_number}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteEntry && deleteMutation.mutate(deleteEntry.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
