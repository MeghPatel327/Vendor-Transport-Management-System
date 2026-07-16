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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Pencil, Trash2, Users, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const vendorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
})
type VendorForm = z.infer<typeof vendorSchema>

export default function VendorsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null)

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors', search],
    queryFn: () => vendorsService.getAll({ search }),
    staleTime: 30_000,
  })

  const form = useForm<VendorForm>({ resolver: zodResolver(vendorSchema) })

  const createMutation = useMutation({
    mutationFn: vendorsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast({ title: 'Vendor created', description: 'New vendor added successfully.' } as any)
      setDialogOpen(false)
      form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create vendor.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: VendorForm }) => vendorsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast({ title: 'Vendor updated', description: 'Changes saved successfully.' } as any)
      setDialogOpen(false)
      setEditVendor(null)
      form.reset()
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update vendor.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: vendorsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast({ title: 'Vendor deleted', description: 'Vendor removed successfully.' } as any)
      setDeleteVendor(null)
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete vendor.', variant: 'destructive' }),
  })

  const openAddDialog = () => {
    setEditVendor(null)
    form.reset({ name: '' })
    setDialogOpen(true)
  }

  const openEditDialog = (vendor: Vendor) => {
    setEditVendor(vendor)
    form.reset({ name: vendor.name })
    setDialogOpen(true)
  }

  const onSubmit = (data: VendorForm) => {
    if (editVendor) {
      updateMutation.mutate({ id: editVendor.id, data })
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
            <Users className="h-6 w-6 text-primary" /> Vendors
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your vendor directory</p>
        </div>
        <Button onClick={openAddDialog} id="add-vendor-btn">
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="vendor-search"
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium text-muted-foreground">
                {search ? 'No vendors match your search' : 'No vendors yet'}
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {search ? 'Try a different search term' : 'Add your first vendor to get started'}
              </p>
              {!search && (
                <Button className="mt-4" onClick={openAddDialog} variant="outline">
                  <Plus className="h-4 w-4" /> Add Vendor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Added On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor, idx) => (
                  <TableRow
                    key={vendor.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/vendors/${vendor.id}`)}
                  >
                    <TableCell className="text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(vendor.created_at)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(vendor)}
                          id={`edit-vendor-${vendor.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteVendor(vendor)}
                          id={`delete-vendor-${vendor.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/vendors/${vendor.id}`)}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
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

      {/* Footer count */}
      {!isLoading && vendors.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} id="vendor-form">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="vendor-name">Vendor Name *</Label>
                <Input
                  id="vendor-name"
                  placeholder="e.g. Sharma Traders"
                  {...form.register('name')}
                  disabled={isMutating}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isMutating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating} id="vendor-form-submit">
                {isMutating ? 'Saving…' : editVendor ? 'Save Changes' : 'Add Vendor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteVendor} onOpenChange={(open) => !open && setDeleteVendor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteVendor?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteVendor && deleteMutation.mutate(deleteVendor.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
