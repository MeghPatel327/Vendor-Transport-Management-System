import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ordersService } from '@/services/orders.service'
import { vendorsService } from '@/services/vendors.service'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatCurrency, formatNumber, calcAmount, ORDER_STATUS_COLORS, todayISO } from '@/lib/utils'
import type { Order, OrderStatus } from '@/types'
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
import { Plus, Search, Pencil, Trash2, ShoppingCart } from 'lucide-react'
import { useWatch } from 'react-hook-form'

const orderSchema = z.object({
  vendor_id: z.coerce.number().min(1, 'Please select a vendor'),
  item: z.string().min(1, 'Item is required').max(200),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  rate: z.coerce.number().positive('Rate must be positive'),
  status: z.enum(['Pending', 'Received']),
  order_date: z.string().min(1, 'Date is required'),
})
type OrderForm = z.infer<typeof orderSchema>

function AmountPreview({ control }: { control: any }) {
  const quantity = useWatch({ control, name: 'quantity' })
  const rate = useWatch({ control, name: 'rate' })
  const amount = calcAmount(Number(quantity) || 0, Number(rate) || 0)
  return (
    <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Calculated Amount</span>
      <span className="font-bold text-lg">{formatCurrency(amount)}</span>
    </div>
  )
}

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [filterVendor, setFilterVendor] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', { search, vendor_id: filterVendor !== 'all' ? filterVendor : undefined, status: filterStatus !== 'all' ? filterStatus : undefined }],
    queryFn: () => ordersService.getAll({
      search,
      vendor_id: filterVendor !== 'all' ? Number(filterVendor) : undefined,
      status: filterStatus !== 'all' ? filterStatus as OrderStatus : undefined,
    }),
    staleTime: 30_000,
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsService.getAll(),
  })

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { status: 'Pending', order_date: todayISO() },
  })

  const createMutation = useMutation({
    mutationFn: ordersService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast({ title: 'Order created' } as any)
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create order.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: OrderForm }) => ordersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast({ title: 'Order updated' } as any)
      setDialogOpen(false)
      setEditOrder(null)
      form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update order.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: ordersService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast({ title: 'Order deleted' } as any)
      setDeleteOrder(null)
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete order.', variant: 'destructive' }),
  })

  const openAdd = () => { setEditOrder(null); form.reset({ status: 'Pending', order_date: todayISO() }); setDialogOpen(true) }
  const openEdit = (o: Order) => { setEditOrder(o); form.reset({ vendor_id: o.vendor_id, item: o.item, quantity: o.quantity, rate: o.rate, status: o.status, order_date: o.order_date.split('T')[0] }); setDialogOpen(true) }

  const onSubmit = (data: OrderForm) => {
    if (editOrder) updateMutation.mutate({ id: editOrder.id, data })
    else createMutation.mutate(data)
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  const totalAmount = orders.reduce((s, o) => s + o.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Orders
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Track all purchase orders</p>
        </div>
        <Button onClick={openAdd} id="add-order-btn"><Plus className="h-4 w-4" /> New Order</Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Orders', value: orders.length },
          { label: 'Total Value', value: formatCurrency(totalAmount) },
          { label: 'Pending', value: orders.filter(o => o.status === 'Pending').length },
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
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="order-search" placeholder="Search by item…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterVendor} onValueChange={setFilterVendor}>
              <SelectTrigger className="w-[180px]" id="order-filter-vendor">
                <SelectValue placeholder="All vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]" id="order-filter-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium text-muted-foreground">No orders found</p>
              <Button className="mt-4" onClick={openAdd} variant="outline"><Plus className="h-4 w-4" /> New Order</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.vendor_name ?? `Vendor #${order.vendor_id}`}</TableCell>
                    <TableCell>{order.item}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(order.quantity)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(order.rate)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(order.amount)}</TableCell>
                    <TableCell><Badge className={ORDER_STATUS_COLORS[order.status]} variant="outline">{order.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(order.order_date)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(order)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteOrder(order)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editOrder ? 'Edit Order' : 'New Order'}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="order-vendor">Vendor *</Label>
                <Select
                  value={String(form.watch('vendor_id') || '')}
                  onValueChange={v => form.setValue('vendor_id', Number(v))}
                >
                  <SelectTrigger id="order-vendor">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.vendor_id && <p className="text-sm text-destructive">{form.formState.errors.vendor_id.message}</p>}
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="order-item">Item *</Label>
                <Input id="order-item" placeholder="e.g. Steel Pipes" {...form.register('item')} disabled={isMutating} />
                {form.formState.errors.item && <p className="text-sm text-destructive">{form.formState.errors.item.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-qty">Quantity *</Label>
                <Input id="order-qty" type="number" min="0" step="any" placeholder="0" {...form.register('quantity')} disabled={isMutating} />
                {form.formState.errors.quantity && <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-rate">Rate (₹) *</Label>
                <Input id="order-rate" type="number" min="0" step="any" placeholder="0.00" {...form.register('rate')} disabled={isMutating} />
                {form.formState.errors.rate && <p className="text-sm text-destructive">{form.formState.errors.rate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-status">Status</Label>
                <Select value={form.watch('status')} onValueChange={v => form.setValue('status', v as OrderStatus)}>
                  <SelectTrigger id="order-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-date">Order Date *</Label>
                <Input id="order-date" type="date" {...form.register('order_date')} disabled={isMutating} />
              </div>
              <div className="col-span-2">
                <AmountPreview control={form.control} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isMutating}>Cancel</Button>
              <Button type="submit" disabled={isMutating}>{isMutating ? 'Saving…' : editOrder ? 'Save Changes' : 'Create Order'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteOrder} onOpenChange={open => !open && setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order?</AlertDialogTitle>
            <AlertDialogDescription>Delete order for <strong>{deleteOrder?.item}</strong>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => deleteOrder && deleteMutation.mutate(deleteOrder.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
