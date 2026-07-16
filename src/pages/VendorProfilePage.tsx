import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vendorsService } from '@/services/vendors.service'
import { ordersService } from '@/services/orders.service'
import { transportService } from '@/services/transport.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatCurrency, formatNumber, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS } from '@/lib/utils'
import { ArrowLeft, Users, ShoppingCart, Truck } from 'lucide-react'

export default function VendorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const vendorId = Number(id)

  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: () => vendorsService.getById(vendorId),
    enabled: !!vendorId,
  })

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', { vendor_id: vendorId }],
    queryFn: () => ordersService.getAll({ vendor_id: vendorId }),
    enabled: !!vendorId,
  })

  const { data: transport = [], isLoading: transportLoading } = useQuery({
    queryKey: ['transport', { vendor_id: vendorId }],
    queryFn: () => transportService.getAll({ vendor_id: vendorId }),
    enabled: !!vendorId,
  })

  if (vendorLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Vendor not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/vendors')}>
          Back to Vendors
        </Button>
      </div>
    )
  }

  const totalOrderAmount = orders.reduce((s, o) => s + o.amount, 0)
  const totalTransportAmount = transport.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/vendors')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> {vendor.name}
          </h1>
          <p className="text-muted-foreground text-sm">Added {formatDate(vendor.created_at)}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-xl font-bold">{orders.length}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Value: {formatCurrency(totalOrderAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transport Entries</p>
                <p className="text-xl font-bold">{transport.length}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Value: {formatCurrency(totalTransportAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Payments</p>
                <p className="text-xl font-bold">{transport.filter(t => t.payment_status === 'Pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="transport">Transport ({transport.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card className="border-0 shadow-sm mt-2">
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="space-y-3 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No orders found for this vendor.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.item}</TableCell>
                        <TableCell>{formatNumber(order.quantity)}</TableCell>
                        <TableCell>{formatCurrency(order.rate)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(order.amount)}</TableCell>
                        <TableCell>
                          <Badge className={ORDER_STATUS_COLORS[order.status]} variant="outline">{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(order.order_date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transport">
          <Card className="border-0 shadow-sm mt-2">
            <CardContent className="p-0">
              {transportLoading ? (
                <div className="space-y-3 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : transport.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No transport entries found for this vendor.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>LR No.</TableHead>
                      <TableHead>Transport</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Dispatched</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transport.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-sm">{t.lr_number}</TableCell>
                        <TableCell>{t.transport_name}</TableCell>
                        <TableCell>{t.city}</TableCell>
                        <TableCell>{t.item}</TableCell>
                        <TableCell>{formatNumber(t.quantity)}</TableCell>
                        <TableCell className="text-emerald-600">{formatNumber(t.dispatched_quantity)}</TableCell>
                        <TableCell className="text-amber-600">{formatNumber(t.remaining_quantity)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(t.amount)}</TableCell>
                        <TableCell>
                          <Badge className={PAYMENT_STATUS_COLORS[t.payment_status]} variant="outline">{t.payment_status}</Badge>
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
    </div>
  )
}
