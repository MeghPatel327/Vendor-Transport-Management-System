import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Search, Pencil, Trash2, Truck, ChevronDown, ChevronRight, Package, Share2, Check, Filter } from 'lucide-react'

// Pre-defined Item Options with Checkboxes
const DEFAULT_PRESET_ITEMS = [
  'Jain 10*14 - 1',
  'Jain 10*18 - 2',
  'chibba 19*28 - 2',
  'clip 8*3 - 1',
  'BTC 7*4 - 1',
]

const transportSchema = z.object({
  transport_name: z.string().min(1, 'Transport name is required'),
  lr_number: z.string().min(1, 'LR number is required'),
  items: z.array(z.string()).min(1, 'Select at least one item'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  rate: z.coerce.number().positive('Rate must be positive'),
  payment_status: z.enum(['Pending', 'Paid']),
  booking_date: z.string().min(1, 'Booking date is required'),
})

type TransportForm = z.infer<typeof transportSchema>

// ── Group by LR ───────────────────────────────────────────────────────────────
interface LRGroup {
  lr_number: string
  transport_name: string
  booking_date: string
  payment_status: PaymentStatus
  items: Transport[]
  totalItems: number
  totalAmount: number
  totalQuantity: number
}

function buildShareText(group: LRGroup): string {
  return [
    `📦 LR No: ${group.lr_number}`,
    `🚛 Transport Name: ${group.transport_name}`,
    `📅 Booking Date: ${formatDate(group.booking_date)}`,
    `Status: ${group.payment_status}`,
    '',
    'Items:',
    ...group.items.map(t => `  • ${t.item} — Lot/Qty: ${formatNumber(t.quantity)}`),
    '',
    `Total Items: ${group.totalItems}`,
    `Total Lot/Qty: ${formatNumber(group.totalQuantity)}`,
  ].join('\n')
}

export default function TransportPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [filterTransport, setFilterTransport] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<Transport | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<Transport | null>(null)
  const [expandedLRs, setExpandedLRs] = useState<Set<string>>(new Set())

  const { data: transport = [], isLoading } = useQuery({
    queryKey: ['transport', { search, transport_name: filterTransport, payment_status: filterPayment }],
    queryFn: () => transportService.getAll({
      search,
      transport_name: filterTransport !== 'all' ? filterTransport : undefined,
      payment_status: filterPayment !== 'all' ? filterPayment as PaymentStatus : undefined,
    }),
    staleTime: 30_000,
  })

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsService.getAll() })

  // Unique transport names for dropdown filtering
  const transportNames = useMemo(() => {
    const fromEntries = transport.map(t => t.transport_name).filter(Boolean)
    const fromVendors = vendors.map(v => v.name)
    return [...new Set([...fromEntries, ...fromVendors])].sort()
  }, [transport, vendors])

  // Group by LR Number
  const lrGroups = useMemo<LRGroup[]>(() => {
    const map = new Map<string, Transport[]>()
    for (const t of transport) {
      if (!map.has(t.lr_number)) map.set(t.lr_number, [])
      map.get(t.lr_number)!.push(t)
    }
    return Array.from(map.entries()).map(([lr_number, items]) => ({
      lr_number,
      transport_name: items[0].transport_name,
      booking_date: items[0].booking_date || items[0].transport_date,
      payment_status: items[0].payment_status === 'Paid' ? 'Paid' : 'Pending',
      items,
      totalItems: items.length,
      totalAmount: items.reduce((s, i) => s + i.amount, 0),
      totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    }))
  }, [transport])

  const totalRemainingGoods = useMemo(() => {
    return transport.reduce((sum, t) => sum + (t.payment_status === 'Pending' ? t.quantity : 0), 0)
  }, [transport])

  const toggleLR = (lr: string) => {
    setExpandedLRs(prev => {
      const next = new Set(prev)
      if (next.has(lr)) next.delete(lr); else next.add(lr)
      return next
    })
  }

  // ── Form Setup ─────────────────────────────────────────────────────────────
  const form = useForm<TransportForm>({
    resolver: zodResolver(transportSchema),
    defaultValues: {
      transport_name: '',
      lr_number: '',
      items: [],
      quantity: 1,
      rate: 1,
      payment_status: 'Pending',
      booking_date: todayISO(),
    },
  })

  const selectedItems = form.watch('items') || []

  const toggleItemCheckbox = (item: string) => {
    const current = form.getValues('items') || []
    if (current.includes(item)) {
      form.setValue('items', current.filter(i => i !== item), { shouldValidate: true })
    } else {
      form.setValue('items', [...current, item], { shouldValidate: true })
    }
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: transportService.create,
    onError: () => toast({ title: 'Error', description: 'Failed to create transport entry.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => transportService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport'] })
      queryClient.invalidateQueries({ queryKey: ['hissab'] })
      toast({ title: 'Transport entry updated' } as any)
      setDialogOpen(false); setEditEntry(null); form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update transport entry.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: transportService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport'] })
      queryClient.invalidateQueries({ queryKey: ['hissab'] })
      toast({ title: 'Transport entry deleted' } as any); setDeleteEntry(null)
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete transport entry.', variant: 'destructive' }),
  })

  const isMutating = createMutation.isPending || updateMutation.isPending

  const openAdd = () => {
    setEditEntry(null)
    form.reset({
      transport_name: transportNames[0] || '',
      lr_number: '',
      items: [DEFAULT_PRESET_ITEMS[0]],
      quantity: 1,
      rate: 100,
      payment_status: 'Pending',
      booking_date: todayISO(),
    })
    setDialogOpen(true)
  }

  const openEdit = (t: Transport) => {
    setEditEntry(t)
    form.reset({
      transport_name: t.transport_name,
      lr_number: t.lr_number,
      items: [t.item],
      quantity: t.quantity,
      rate: t.rate,
      payment_status: t.payment_status === 'Paid' ? 'Paid' : 'Pending',
      booking_date: (t.booking_date || t.transport_date || todayISO()).split('T')[0],
    })
    setDialogOpen(true)
  }

  const handlePendingClick = (t: Transport) => {
    updateMutation.mutate({ id: t.id, data: { payment_status: 'Paid' } })
  }

  const onSubmit = async (data: TransportForm) => {
    if (editEntry) {
      updateMutation.mutate({
        id: editEntry.id,
        data: {
          transport_name: data.transport_name,
          lr_number: data.lr_number,
          item: data.items[0] || 'Default Item',
          quantity: data.quantity,
          rate: data.rate,
          payment_status: data.payment_status,
          booking_date: data.booking_date,
        },
      })
    } else {
      try {
        for (const item of data.items) {
          await createMutation.mutateAsync({
            transport_name: data.transport_name,
            lr_number: data.lr_number,
            item,
            quantity: data.quantity,
            rate: data.rate,
            payment_status: data.payment_status,
            booking_date: data.booking_date,
          })
        }
        queryClient.invalidateQueries({ queryKey: ['transport'] })
        queryClient.invalidateQueries({ queryKey: ['hissab'] })
        toast({ title: `${data.items.length} item(s) added under LR ${data.lr_number}` } as any)
        setDialogOpen(false); form.reset()
      } catch { /* handled by mutation onError */ }
    }
  }

  const handleShare = useCallback((group: LRGroup) => {
    const text = buildShareText(group)
    if (navigator.share) {
      navigator.share({ title: `Transport LR ${group.lr_number}`, text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    toast({ title: '📋 Copied!', description: 'Transport details copied to clipboard' } as any)
  }, [toast])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" /> Transport Entry
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Record transport bookings, items, and LR details</p>
        </div>
        <Button onClick={openAdd} id="add-transport-btn"><Plus className="h-4 w-4" /> Add Transport Entry</Button>
      </div>

      {/* Summary Cards including Total Remaining Goods */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total LR Entries</p>
            <p className="text-lg font-bold mt-1">{lrGroups.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Payment LRs</p>
            <p className="text-lg font-bold mt-1 text-amber-600">
              {lrGroups.filter(g => g.payment_status === 'Pending').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Lot / Goods</p>
            <p className="text-lg font-bold mt-1">
              {formatNumber(transport.reduce((s, t) => s + t.quantity, 0))}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 font-medium">Total Remaining Goods</p>
            <p className="text-lg font-bold mt-1 text-amber-700">
              {formatNumber(totalRemainingGoods)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="transport-search"
                placeholder="Search LR no or Transport Name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterTransport} onValueChange={setFilterTransport}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Transport Names" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transport Names</SelectItem>
                {transportNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
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
                    <TableHead className="text-right">Items Count</TableHead>
                    <TableHead className="text-right">Total Lot / Qty</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Booking Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lrGroups.map(group => {
                    const isExpanded = expandedLRs.has(group.lr_number)
                    return (
                      <>
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
                          <TableCell className="font-semibold">{group.transport_name}</TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1 text-sm">
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              {group.totalItems} {group.totalItems === 1 ? 'item' : 'items'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatNumber(group.totalQuantity)}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Badge
                              className={`${PAYMENT_STATUS_COLORS[group.payment_status]} cursor-pointer hover:opacity-80`}
                              variant="outline"
                              onClick={() => handlePendingClick(group.items[0])}
                            >
                              {group.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(group.booking_date)}</TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              title="Share Entry"
                              onClick={() => handleShare(group)}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Items */}
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
                            <TableCell className="text-right font-mono font-semibold">
                              {formatNumber(t.quantity)}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${PAYMENT_STATUS_COLORS[t.payment_status]} text-xs`} variant="outline">
                                {t.payment_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{formatDate(t.booking_date || t.transport_date)}</TableCell>
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Edit Transport Entry' : 'New Transport Entry'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Transport Name */}
              <div className="col-span-2 space-y-2">
                <Label htmlFor="t-name">Transport Name *</Label>
                <Input
                  id="t-name"
                  placeholder="e.g. Gati Logistics"
                  {...form.register('transport_name')}
                  disabled={isMutating}
                />
                {form.formState.errors.transport_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.transport_name.message}</p>
                )}
              </div>

              {/* LR Number */}
              <div className="space-y-2">
                <Label htmlFor="t-lr">LR Number *</Label>
                <Input id="t-lr" placeholder="e.g. 5783" {...form.register('lr_number')} disabled={isMutating} />
                {form.formState.errors.lr_number && <p className="text-sm text-destructive">{form.formState.errors.lr_number.message}</p>}
              </div>

              {/* Booking Date */}
              <div className="space-y-2">
                <Label htmlFor="t-date">Booking Date *</Label>
                <Input id="t-date" type="date" {...form.register('booking_date')} disabled={isMutating} />
                {form.formState.errors.booking_date && <p className="text-sm text-destructive">{form.formState.errors.booking_date.message}</p>}
              </div>

              {/* Item Dropdown with Checkbox */}
              <div className="col-span-2 space-y-2">
                <Label>Item Name (Stored in Dropdown with Checkbox) *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {selectedItems.length > 0
                          ? selectedItems.join(', ')
                          : 'Select Items…'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-2" align="start">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Select Preset Items:</p>
                      {DEFAULT_PRESET_ITEMS.map((itemOption) => {
                        const isChecked = selectedItems.includes(itemOption)
                        return (
                          <div
                            key={itemOption}
                            className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleItemCheckbox(itemOption)}
                          >
                            <Checkbox checked={isChecked} onCheckedChange={() => toggleItemCheckbox(itemOption)} />
                            <span className="text-sm">{itemOption}</span>
                          </div>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                {form.formState.errors.items && (
                  <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>
                )}
              </div>

              {/* Quantity / Lot */}
              <div className="space-y-2">
                <Label htmlFor="t-qty">Lot / Quantity *</Label>
                <Input id="t-qty" type="number" min="1" placeholder="e.g. 5" {...form.register('quantity')} disabled={isMutating} />
                {form.formState.errors.quantity && <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>}
              </div>

              {/* Rate */}
              <div className="space-y-2">
                <Label htmlFor="t-rate">Rate (₹) *</Label>
                <Input id="t-rate" type="number" min="1" placeholder="500" {...form.register('rate')} disabled={isMutating} />
                {form.formState.errors.rate && <p className="text-sm text-destructive">{form.formState.errors.rate.message}</p>}
              </div>

              {/* Payment Status */}
              <div className="space-y-2 col-span-2">
                <Label>Payment Status</Label>
                <Select value={form.watch('payment_status')} onValueChange={v => form.setValue('payment_status', v as PaymentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending (Unpaid)</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isMutating}>Cancel</Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? 'Saving…' : editEntry ? 'Save Changes' : 'Save Transport Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={open => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transport Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete entry for LR <strong>{deleteEntry?.lr_number}</strong>? This action cannot be undone.
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
