import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorsService } from '@/services/vendors.service'
import { ordersService } from '@/services/orders.service'
import { transportService } from '@/services/transport.service'
import { hissabService } from '@/services/hissab.service'
import { formatDate, formatCurrency, formatNumber, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart3, Users, ShoppingCart, Truck, Calculator } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

type ReportType = 'vendors' | 'orders' | 'transport' | 'hissab'

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1']

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('orders')

  const { data: vendors = [], isLoading: vLoading } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsService.getAll() })
  const { data: orders = [], isLoading: oLoading } = useQuery({ queryKey: ['orders', {}], queryFn: () => ordersService.getAll() })
  const { data: transport = [], isLoading: tLoading } = useQuery({ queryKey: ['transport', {}], queryFn: () => transportService.getAll() })
  const { data: hissab, isLoading: hLoading } = useQuery({ queryKey: ['hissab', {}], queryFn: () => hissabService.getSummary() })

  const isLoading = vLoading || oLoading || tLoading || hLoading

  // Chart data
  const ordersByStatus = [
    { name: 'Pending', value: orders.filter(o => o.status === 'Pending').length },
    { name: 'Received', value: orders.filter(o => o.status === 'Received').length },
  ]

  const paymentByStatus = [
    { name: 'Pending', value: transport.filter(t => t.payment_status === 'Pending').length },
    { name: 'Paid', value: transport.filter(t => t.payment_status === 'Paid').length },
    { name: 'Partial', value: transport.filter(t => t.payment_status === 'Partial').length },
  ]

  const hissabByVendor = hissab
    ? Object.entries(
        hissab.entries.reduce((acc, e) => {
          acc[e.vendor_name] = (acc[e.vendor_name] || 0) + e.hissab_amount
          return acc
        }, {} as Record<string, number>)
      ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Analytics and data overview</p>
        </div>
        <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
          <SelectTrigger className="w-[160px]" id="report-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="orders">Orders</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
            <SelectItem value="vendors">Vendors</SelectItem>
            <SelectItem value="hissab">Hissab</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Orders by Status */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={ordersByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {ordersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Transport Payment Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={paymentByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {paymentByStatus.map((_, i) => <Cell key={i} fill={COLORS[i + 2]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hissab by Vendor */}
        {hissabByVendor.length > 0 && (
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Hissab Amount by Vendor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hissabByVendor} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Data Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base capitalize">{reportType} Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <>
              {reportType === 'vendors' && (
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Added On</TableHead></TableRow></TableHeader>
                  <TableBody>{vendors.map((v, i) => (
                    <TableRow key={v.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(v.created_at)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
              {reportType === 'orders' && (
                <Table>
                  <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                  <TableBody>{orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell>{o.vendor_name}</TableCell>
                      <TableCell>{o.item}</TableCell>
                      <TableCell className="text-right">{formatNumber(o.quantity)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(o.amount)}</TableCell>
                      <TableCell><Badge className={ORDER_STATUS_COLORS[o.status]} variant="outline">{o.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(o.order_date)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
              {reportType === 'transport' && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>LR No.</TableHead><TableHead>Vendor</TableHead><TableHead>City</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Dispatched</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader>
                    <TableBody>{transport.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono">{t.lr_number}</TableCell>
                        <TableCell>{t.vendor_name}</TableCell>
                        <TableCell>{t.city}</TableCell>
                        <TableCell>{t.item}</TableCell>
                        <TableCell className="text-right">{formatNumber(t.dispatched_quantity)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(t.amount)}</TableCell>
                        <TableCell><Badge className={PAYMENT_STATUS_COLORS[t.payment_status]} variant="outline">{t.payment_status}</Badge></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
              {reportType === 'hissab' && (
                <Table>
                  <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>City</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Dispatched</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Hissab Amount</TableHead></TableRow></TableHeader>
                  <TableBody>{(hissab?.entries ?? []).map(e => (
                    <TableRow key={e.transport_id}>
                      <TableCell>{e.vendor_name}</TableCell>
                      <TableCell>{e.city}</TableCell>
                      <TableCell>{e.item}</TableCell>
                      <TableCell className="text-right">{formatNumber(e.dispatched_quantity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(e.rate)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(e.hissab_amount)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
