import { Plus, Tags, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button, Card } from '@/components'
import {
  ConfirmDialog,
  EmptyState,
  ErrorText,
  FieldLabel,
  QueryState,
} from './AdminUi'
import { ADMIN_INPUT_CLASSES } from './adminUtils'
import {
  useAddCategory,
  useAddSize,
  useCategories,
  useRemoveCategory,
  useRemoveSize,
  useSizes,
} from './useTaxonomy'

type PendingDelete = { kind: 'category' | 'size'; id: string; label: string }

export function TaxonomyPanel() {
  const categoriesQuery = useCategories()
  const sizesQuery = useSizes()
  const categories = categoriesQuery.data ?? []
  const sizes = sizesQuery.data ?? []
  const addCategory = useAddCategory()
  const removeCategory = useRemoveCategory()
  const addSize = useAddSize()
  const removeSize = useRemoveSize()

  const [categoryName, setCategoryName] = useState('')
  const [sizeLabel, setSizeLabel] = useState('')
  const [sizeWidth, setSizeWidth] = useState('')
  const [sizeHeight, setSizeHeight] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const categoryId = useId()
  const sizeLabelId = useId()
  const sizeWidthId = useId()
  const sizeHeightId = useId()

  function handleAddCategory(e: FormEvent) {
    e.preventDefault()
    const name = categoryName.trim()
    if (!name) return
    addCategory.mutate(name, { onSuccess: () => setCategoryName('') })
  }

  function handleAddSize(e: FormEvent) {
    e.preventDefault()
    const label = sizeLabel.trim()
    const width = Number(sizeWidth)
    const height = Number(sizeHeight)
    if (!label || !(width > 0) || !(height > 0)) return
    addSize.mutate(
      { label, width, height },
      {
        onSuccess: () => {
          setSizeLabel('')
          setSizeWidth('')
          setSizeHeight('')
        },
      },
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card ticks className="p-5">
        <div className="flex items-center gap-2">
          <Tags aria-hidden="true" className="size-4 text-accent" />
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Categories
          </h3>
        </div>
        <form
          onSubmit={handleAddCategory}
          className="mt-4 flex items-end gap-2"
        >
          <label htmlFor={categoryId} className="block w-full">
            <FieldLabel>New category</FieldLabel>
            <input
              id={categoryId}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="New category name"
              className={ADMIN_INPUT_CLASSES}
            />
          </label>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!categoryName.trim() || addCategory.isPending}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add
          </Button>
        </form>
        <div className="mt-2">
          <ErrorText error={addCategory.error} />
        </div>
        <QueryState
          isLoading={categoriesQuery.isLoading}
          error={categoriesQuery.error}
          onRetry={() => categoriesQuery.refetch()}
          label="Loading categories…"
        />
        {!categoriesQuery.isLoading &&
          !categoriesQuery.error &&
          categories.length === 0 && (
            <EmptyState>No categories yet.</EmptyState>
          )}
        <ul className="mt-4 space-y-1.5">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between border border-ink/10 px-3 py-2 text-sm dark:border-paper/15"
            >
              {c.name}
              <button
                type="button"
                onClick={() =>
                  setPendingDelete({
                    kind: 'category',
                    id: c.id,
                    label: c.name,
                  })
                }
                title="Remove category"
                aria-label={`Remove category ${c.name}`}
                className="text-ink/40 hover:text-brand-error dark:text-paper/40"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card ticks className="p-5">
        <div className="flex items-center gap-2">
          <Tags aria-hidden="true" className="size-4 text-accent" />
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Sizes
          </h3>
        </div>
        <form onSubmit={handleAddSize} className="mt-4 space-y-2">
          <label htmlFor={sizeLabelId} className="block">
            <FieldLabel>New size label</FieldLabel>
            <input
              id={sizeLabelId}
              value={sizeLabel}
              onChange={(e) => setSizeLabel(e.target.value)}
              placeholder="e.g. LED 12 × 24 ft"
              className={ADMIN_INPUT_CLASSES}
            />
          </label>
          <div className="flex items-end gap-2">
            <label htmlFor={sizeWidthId} className="block w-full">
              <FieldLabel>Width (ft)</FieldLabel>
              <input
                id={sizeWidthId}
                value={sizeWidth}
                onChange={(e) => setSizeWidth(e.target.value)}
                type="number"
                min="1"
                className={ADMIN_INPUT_CLASSES}
              />
            </label>
            <label htmlFor={sizeHeightId} className="block w-full">
              <FieldLabel>Height (ft)</FieldLabel>
              <input
                id={sizeHeightId}
                value={sizeHeight}
                onChange={(e) => setSizeHeight(e.target.value)}
                type="number"
                min="1"
                className={ADMIN_INPUT_CLASSES}
              />
            </label>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="shrink-0"
              disabled={addSize.isPending}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Add
            </Button>
          </div>
        </form>
        <div className="mt-2">
          <ErrorText error={addSize.error} />
        </div>
        <QueryState
          isLoading={sizesQuery.isLoading}
          error={sizesQuery.error}
          onRetry={() => sizesQuery.refetch()}
          label="Loading sizes…"
        />
        {!sizesQuery.isLoading && !sizesQuery.error && sizes.length === 0 && (
          <EmptyState>No sizes yet.</EmptyState>
        )}
        <ul className="mt-4 space-y-1.5">
          {sizes.map((sz) => (
            <li
              key={sz.id}
              className="flex items-center justify-between border border-ink/10 px-3 py-2 text-sm dark:border-paper/15"
            >
              {sz.label}
              <button
                type="button"
                onClick={() =>
                  setPendingDelete({ kind: 'size', id: sz.id, label: sz.label })
                }
                title="Remove size"
                aria-label={`Remove size ${sz.label}`}
                className="text-ink/40 hover:text-brand-error dark:text-paper/40"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Remove ${pendingDelete?.kind ?? ''} "${pendingDelete?.label ?? ''}"?`}
        description="It can only be removed while no billboard uses it."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => {
          if (!pendingDelete) return
          return pendingDelete.kind === 'category'
            ? removeCategory.mutateAsync(pendingDelete.id)
            : removeSize.mutateAsync(pendingDelete.id)
        }}
      />
    </div>
  )
}
