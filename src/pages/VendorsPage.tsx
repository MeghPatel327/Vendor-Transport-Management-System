import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { vendorsService } from '@/services/vendors.service'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import type { Vendor } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Pencil, Trash2, Users, Truck } from 'lucide-react'

const masterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
})
type MasterForm = z.infer<typeof masterSchema>

export default function VendorsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'customer' | 'transport'>('customer')
  const [editItem, setEditItem] = useState<Vendor | null>(null)
  const [deleteItem, setDeleteItem] = useState<Vendor | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['vendors', search],
    queryFn: () => vendorsService.getAll({ search }),
    staleTime: 30_000,
  })

  const form = useForm<MasterForm>({ resolver: zodResolver(masterSchema) })

  const createMutation = useMutation({
    mutationFn: vendorsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast({ title: `${activeTab === 'customer' ? 'Customer' : 'Transport'} created` } as any)
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save entry.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MasterForm }) => vendorsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast({ title: 'Entry updated' } as any)
      setDialogOpen(false)
      setEditItem(null)
      form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update entry.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: vendorsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast({ title: 'Entry deleted' } as any)
      setDeleteItem(null)
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete entry.', variant: 'destructive' }),
  })

  const openAddDialog = () => {
    setEditItem(null)
    form.reset({ name: '' })
    setDialogOpen(true)
  }

  const openEditDialog = (item: Vendor) => {
    setEditItem(item)
    form.reset({ name: item.name })
    setDialogOpen(true)
  }

  const onSubmit = (data: MasterForm) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Master Directory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage Customer database and Transport database</p>
        </div>
        <Button onClick={openAddDialog} id="add-master-btn">
          <Plus className="h-4 w-4" /> Add {activeTab === 'customer' ? 'Customer' : 'Transport'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="customer" className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Customer Database
          </TabsTrigger>
          <TabsTrigger value="transport" className="font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4" /> Transport Database
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="master-search"
                  placeholder={`Search ${activeTab === 'customer' ? 'Customers' : 'Transports'}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="font-medium text-muted-foreground">No entries found</p>
                  <Button className="mt-4" onClick={openAddDialog} variant="outline">
                    <Plus className="h-4 w-4" /> Add Entry
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead>{activeTab === 'customer' ? 'Customer Name' : 'Transport Name'}</TableHead>
                      <TableHead>Added On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-semibold">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(item.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteItem(item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? `Edit ${activeTab === 'customer' ? 'Customer' : 'Transport'}` : `Add New ${activeTab === 'customer' ? 'Customer' : 'Transport'}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="master-name">{activeTab === 'customer' ? 'Customer Name' : 'Transport Name'} *</Label>
                <Input
                  id="master-name"
                  placeholder={activeTab === 'customer' ? 'e.g. Acme Traders' : 'e.g. Gati Logistics'}
                  {...form.register('name')}
                  disabled={isMutating}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isMutating}>Cancel</Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? 'Saving…' : editItem ? 'Save Changes' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
