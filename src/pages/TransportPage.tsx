import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { transportService } from '@/services/transport.service'
import { vendorsService } from '@/services/vendors.service'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatCurrency, formatNumber, calcAmount, calcRemainingQuantity, PAYMENT_STATUS_COLORS, todayISO } from '@/lib/utils'
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
import { Plus, Search, Pencil, Trash2, Truck } from 'lucide-react'
import { useWatch } from 'react-hook-form'

const transportSchema = z.object({
  vendor_id: z.coerce.number().min(1, 'Select a vendor'),
  lr_number: z.string().min(1, 'LR number is required'),
  transport_name: z.string().min(1, 'Transport name is required'),
  city: z.string().min(1, 'City is required'),
  item: z.string().min(1, 'Item is required'),
  quantity: z.coerce.number().positive('Must be positive'),
  dispatched_quantity: z.coerce.number().min(0, 'Cannot be negative'),
  rate: z.coerce.number().positive('Must be positive'),
  payment_status: z.enum(['Pending', 'Paid', 'Partial']),
  transport_date: z.string().min(1, 'Date is required'),
}).refine(
  d => d.dispatched_quantity <= d.quantity,
  { message: 'Dispatched quantity cannot exceed total quantity', path: ['dispatched_quantity'] }
)
type TransportForm = z.infer<typeof transportSchema>

function TransportAmountPreview({ control }: { control: any }) {
  const quantity = useWatch({ control, name: 'quantity' })
  const dispatched = useWatch({ control, name: 'dispatched_quantity' })
  const rate = useWatch({ control, name: 'rate' })
  const amount = calcAmount(Number(quantity) || 0, Number(rate) || 0)
  const remaining = calcRemainingQuantity(Number(quantity) || 0, Number(dispatched) || 0)
  return (
    <div className="rounded-lg bg-muted p-3 grid grid-cols-3 gap-2 text-center">
      <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-bold text-sm">{formatCurrency(amount)}</p></div>
      <div><p className="text-xs text-muted-foreground">Remaining Qty</p><p className="font-bold text-sm text-amber-600">{formatNumber(remaining)}</p></div>
      <div><p className="text-xs text-muted-foreground">Hissab</p><p className="font-bold text-sm text-emerald-600">{formatCurrency(calcAmount(Number(dispatched) || 0, Number(rate) || 0))}</p></div>
    </div>
  )
}

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
  const cities = [...new Set(transport.map(t => t.city).filter(Boolean))]

  const form = useForm<TransportForm>({
    resolver: zodResolver(transportSchema),
    defaultValues: { payment_status: 'Pending', transport_date: todayISO(), dispatched_quantity: 0 },
  })

  const createMutation = useMutation({
    mutationFn: transportService.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transport'] }); queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); toast({ title: 'Transport entry created' } as any); setDialogOpen(false); form.reset() },
    onError: () => toast({ title: 'Error', description: 'Failed to create entry.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TransportForm }) => transportService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transport'] }); toast({ title: 'Transport entry updated' } as any); setDialogOpen(false); setEditEntry(null); form.reset() },
    onError: () => toast({ title: 'Error', description: 'Failed to update entry.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: transportService.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transport'] }); queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); toast({ title: 'Transport entry deleted' } as any); setDeleteEntry(null) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete entry.', variant: 'destructive' }),
  })

  const openAdd = () => { setEditEntry(null); form.reset({ payment_status: 'Pending', transport_date: todayISO(), dispatched_quantity: 0 }); setDialogOpen(true) }
  const openEdit = (t: Transport) => {
    setEditEntry(t)
    form.reset({ vendor_id: t.vendor_id, lr_number: t.lr_number, transport_name: t.transport_name, city: t.city, item: t.item, quantity: t.quantity, dispatched_quantity: t.dispatched_quantity, rate: t.rate, payment_status: t.payment_status, transport_date: t.transport_date.split('T')[0] })
    setDialogOpen(true)
  }

  const onSubmit = (data: TransportForm) => {
    if (editEntry) updateMutation.mutate({ id: editEntry.id, data })
    else createMutation.mutate(data)
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" /> Transport
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage dispatch & transport entries</p>
        </div>
        <Button onClick={openAdd} id="add-transport-btn"><Plus className="h-4 w-4" /> Add Entry</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries', value: transport.length },
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

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="transport-search" placeholder="Search LR number…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
          ) : transport.length === 0 ? (
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
                    <TableHead>LR No.</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Transport</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Dispatched</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transport.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm font-medium">{t.lr_number}</TableCell>
                      <TableCell>{t.vendor_name ?? `#${t.vendor_id}`}</TableCell>
                      <TableCell>{t.transport_name}</TableCell>
                      <TableCell>{t.city}</TableCell>
                      <TableCell>{t.item}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(t.quantity)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">{formatNumber(t.dispatched_quantity)}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600">{formatNumber(t.remaining_quantity)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(t.rate)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(t.amount)}</TableCell>
                      <TableCell><Badge className={PAYMENT_STATUS_COLORS[t.payment_status]} variant="outline">{t.payment_status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(t.transport_date)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteEntry(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editEntry ? 'Edit Transport Entry' : 'New Transport Entry'}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <Label htmlFor="t-name">Transport Name *</Label>
                <Input id="t-name" placeholder="e.g. Gati Logistics" {...form.register('transport_name')} disabled={isMutating} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-city">City *</Label>
                <Input id="t-city" placeholder="e.g. Mumbai" {...form.register('city')} disabled={isMutating} />
                {form.formState.errors.city && <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-item">Item *</Label>
                <Input id="t-item" placeholder="e.g. Steel Rods" {...form.register('item')} disabled={isMutating} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-qty">Total Quantity *</Label>
                <Input id="t-qty" type="number" min="0" step="any" placeholder="0" {...form.register('quantity')} disabled={isMutating} />
                {form.formState.errors.quantity && <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-dispatched">Dispatched Quantity</Label>
                <Input id="t-dispatched" type="number" min="0" step="any" placeholder="0" {...form.register('dispatched_quantity')} disabled={isMutating} />
                {form.formState.errors.dispatched_quantity && <p className="text-sm text-destructive">{form.formState.errors.dispatched_quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-rate">Rate (₹) *</Label>
                <Input id="t-rate" type="number" min="0" step="any" placeholder="0.00" {...form.register('rate')} disabled={isMutating} />
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
              <div className="space-y-2">
                <Label htmlFor="t-date">Transport Date *</Label>
                <Input id="t-date" type="date" {...form.register('transport_date')} disabled={isMutating} />
              </div>
              <div className="col-span-2">
                <TransportAmountPreview control={form.control} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isMutating}>Cancel</Button>
              <Button type="submit" disabled={isMutating}>{isMutating ? 'Saving…' : editEntry ? 'Save Changes' : 'Add Entry'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteEntry} onOpenChange={open => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transport Entry?</AlertDialogTitle>
            <AlertDialogDescription>Delete entry LR <strong>{deleteEntry?.lr_number}</strong>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => deleteEntry && deleteMutation.mutate(deleteEntry.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
