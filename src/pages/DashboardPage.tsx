import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboard.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  Users, ShoppingCart, Truck, Calculator,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function StatCard({
  title, value, icon: Icon, color, subtitle, isLoading
}: {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  subtitle?: string
  isLoading?: boolean
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className={`absolute inset-0 opacity-5 ${color}`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={`h-4 w-4 ${color.replace('bg-', 'text-')}`} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
    staleTime: 30_000,
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {user?.name ?? 'Admin'} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's what's happening with your transport and order operations today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Master Directory"
          value={isLoading ? '—' : formatNumber((stats as any)?.total_customers ?? (stats as any)?.total_vendors ?? 0)}
          icon={Users}
          color="bg-blue-500"
          subtitle="Customers & Transports"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Orders"
          value={isLoading ? '—' : formatNumber(stats?.total_orders ?? 0)}
          icon={ShoppingCart}
          color="bg-violet-500"
          subtitle="Active & History orders"
          isLoading={isLoading}
        />
        <StatCard
          title="Transport Entries"
          value={isLoading ? '—' : formatNumber(stats?.total_transport ?? 0)}
          icon={Truck}
          color="bg-amber-500"
          subtitle={`${stats?.pending_payments ?? 0} pending payment`}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Hissab"
          value={isLoading ? '—' : formatCurrency(stats?.total_hissab_amount ?? 0)}
          icon={Calculator}
          color="bg-emerald-500"
          subtitle="Quantity × Rate"
          isLoading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Master Directory', icon: Users, to: '/vendors', color: 'blue' },
            { label: 'New Order', icon: ShoppingCart, to: '/orders', color: 'violet' },
            { label: 'Add Transport', icon: Truck, to: '/transport', color: 'amber' },
            { label: 'View Hissab', icon: Calculator, to: '/hissab', color: 'emerald' },
          ].map(({ label, icon: Icon, to, color }) => (
            <a
              key={to}
              href={to}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer`}
            >
              <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
