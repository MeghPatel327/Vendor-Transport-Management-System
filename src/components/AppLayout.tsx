import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/AppSidebar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      {/* Main content offset for desktop sidebar */}
      <div className="lg:pl-64">
        <main className="p-6 pt-16 lg:pt-6 min-h-screen animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
