import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ordersService } from '@/services/orders.service'
import { vendorsService } from '@/services/vendors.service'
import { useToast } from '@/hooks/use-toast'
import { formatDate, todayISO } from '@/lib/utils'
import type { Order } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Pencil, Trash2, ShoppingCart, Share2, Copy, FileText, CheckCircle2, History, Archive } from 'lucide-react'

// Pre-defined Order Item Options as specified by client
const PRESET_ORDER_ITEMS = [
  'jain 10*14 - 1 - 450',
  'chibba 19*28 - 2 - 320',
  'clip 8*3 - 1 - 330',
  'BTC 7*4 - 1 - 340',
]

const orderSchema = z.object({
  customer_id: z.coerce.number().min(1, 'Please select a Customer Name'),
  item: z.string().min(1, 'Item name is required'),
  order_date: z.string().min(1, 'Date is required'),
})

type OrderForm = z.infer<typeof orderSchema>

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [filterCustomer, setFilterCustomer] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null)

  const printRef = useRef<HTMLDivElement>(null)

  // Fetch all orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', { search, customer_id: filterCustomer !== 'all' ? filterCustomer : undefined }],
    queryFn: () => ordersService.getAll({
      search,
      customer_id: filterCustomer !== 'all' ? Number(filterCustomer) : undefined,
    }),
    staleTime: 30_000,
  })

  // Fetch Customers (Customer Master Database)
  const { data: customers = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsService.getAll(),
  })

  // Active vs History Orders
  const activeOrders = useMemo(() => orders.filter(o => !o.is_history), [orders])
  const historyOrders = useMemo(() => orders.filter(o => o.is_history), [orders])

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { order_date: todayISO() },
  })

  const createMutation = useMutation({
    mutationFn: ordersService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast({ title: 'Order created successfully' } as any)
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create order.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => ordersService.update(id, data),
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
      toast({ title: 'Order deleted' } as any)
      setDeleteOrder(null)
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete order.', variant: 'destructive' }),
  })

  const openAdd = () => {
    setEditOrder(null)
    form.reset({
      customer_id: customers[0]?.id || 1,
      item: PRESET_ORDER_ITEMS[0],
      order_date: todayISO(),
    })
    setDialogOpen(true)
  }

  const openEdit = (o: Order) => {
    setEditOrder(o)
    form.reset({
      customer_id: o.customer_id,
      item: o.item,
      order_date: o.order_date.split('T')[0],
    })
    setDialogOpen(true)
  }

  const handleMarkAsDone = (o: Order) => {
    updateMutation.mutate({ id: o.id, data: { is_history: true } })
    toast({ title: 'Order marked as Done', description: 'Moved to Order History for permanent retrieval.' } as any)
  }

  const onSubmit = (data: OrderForm) => {
    if (editOrder) updateMutation.mutate({ id: editOrder.id, data })
    else createMutation.mutate({ ...data, is_history: false })
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // Share helpers (PDF/Image/Text)
  const handleShareText = (orderList: Order[], title: string) => {
    const text = [
      `📋 ${title.toUpperCase()} ORDERS`,
      ...orderList.map(o => `• Customer: ${o.customer_name || 'Customer'} | Item: ${o.item} | Date: ${formatDate(o.order_date)}`),
    ].join('\n')

    if (navigator.share) {
      navigator.share({ title: `${title} Orders`, text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      alert(`Copied ${title} Orders text to clipboard!`)
    }
  }

  const handlePrintPDF = (title: string) => {
    const win = window.open('', '', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>${title} Orders</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background-color: #f3f4f6; }
          </style>
        </head>
        <body>
          <h2>${title} Orders Statement</h2>
          ${printRef.current?.innerHTML || ''}
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
            <ShoppingCart className="h-6 w-6 text-primary" /> Customer Orders
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage customer orders and order history</p>
        </div>
        <Button onClick={openAdd} id="add-order-btn"><Plus className="h-4 w-4" /> New Order</Button>
      </div>

      {/* Tabs for Active Orders vs Order History */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="active" className="font-semibold">
            Active Orders ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="font-semibold flex items-center gap-1.5">
            <History className="h-4 w-4" /> Order History ({historyOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* ACTIVE ORDERS TAB */}
        <TabsContent value="active" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4 flex flex-col sm:flex-row gap-3 justify-between">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="order-search" placeholder="Search by item name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                  <SelectTrigger className="w-[180px]" id="order-filter-customer">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleShareText(activeOrders, 'Active')}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Text
                </Button>
                <Button size="sm" variant="outline" onClick={() => handlePrintPDF('Active')}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> PDF / Print
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : activeOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="font-medium text-muted-foreground">No active orders found</p>
                  <Button className="mt-4" onClick={openAdd} variant="outline"><Plus className="h-4 w-4" /> Create New Order</Button>
                </div>
              ) : (
                <div ref={printRef} className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeOrders.map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="font-semibold text-primary">{order.customer_name || `Customer #${order.customer_id}`}</TableCell>
                          <TableCell className="font-medium">{order.item}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(order.order_date)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                onClick={() => handleMarkAsDone(order)}
                                title="Move to Order History"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Done
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(order)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteOrder(order)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        </TabsContent>

        {/* ORDER HISTORY TAB */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm border-t-4 border-t-indigo-500">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
                  <Archive className="h-5 w-5" /> Completed Order History
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Archived orders retrievable anytime</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleShareText(historyOrders, 'History')}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Text
                </Button>
                <Button size="sm" variant="outline" onClick={() => handlePrintPDF('History')}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> PDF / Print
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {historyOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="font-medium text-muted-foreground">Order history is empty</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Mark active orders as 'Done' to store them here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyOrders.map(order => (
                      <TableRow key={order.id} className="bg-muted/10">
                        <TableCell className="font-semibold">{order.customer_name || `Customer #${order.customer_id}`}</TableCell>
                        <TableCell className="font-medium">{order.item}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(order.order_date)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteOrder(order)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editOrder ? 'Edit Order' : 'New Customer Order'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="order-customer">Customer Name *</Label>
              <Select
                value={String(form.watch('customer_id') || '')}
                onValueChange={v => form.setValue('customer_id', Number(v))}
              >
                <SelectTrigger id="order-customer">
                  <SelectValue placeholder="Select Customer Name" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.formState.errors.customer_id && <p className="text-sm text-destructive">{form.formState.errors.customer_id.message}</p>}
            </div>

            {/* Entering Item Name */}
            <div className="space-y-2">
              <Label htmlFor="order-item">Entering Item Name *</Label>
              <Select
                value={form.watch('item')}
                onValueChange={v => form.setValue('item', v)}
              >
                <SelectTrigger id="order-item-select">
                  <SelectValue placeholder="Select preset item or type below" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_ORDER_ITEMS.map(itemOpt => (
                    <SelectItem key={itemOpt} value={itemOpt}>{itemOpt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Also allow custom item text entry */}
              <Input
                placeholder="Or type custom item name…"
                {...form.register('item')}
                disabled={isMutating}
                className="mt-2"
              />
              {form.formState.errors.item && <p className="text-sm text-destructive">{form.formState.errors.item.message}</p>}
            </div>

            {/* Order Date */}
            <div className="space-y-2">
              <Label htmlFor="order-date">Order Date *</Label>
              <Input id="order-date" type="date" {...form.register('order_date')} disabled={isMutating} />
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isMutating}>Cancel</Button>
              <Button type="submit" disabled={isMutating}>{isMutating ? 'Saving…' : editOrder ? 'Save Changes' : 'Create Order'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteOrder} onOpenChange={open => !open && setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order?</AlertDialogTitle>
            <AlertDialogDescription>Delete order for <strong>{deleteOrder?.item}</strong>? This action cannot be undone.</AlertDialogDescription>
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
