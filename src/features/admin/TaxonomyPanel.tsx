import { Plus, Tags, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Card } from '@/components'
import {
  useAddCategory,
  useAddSize,
  useCategories,
  useRemoveCategory,
  useRemoveSize,
  useSizes,
} from './useTaxonomy'

export function TaxonomyPanel() {
  const { data: categoriesData } = useCategories()
  const { data: sizesData } = useSizes()
  const categories = categoriesData ?? []
  const sizes = sizesData ?? []
  const addCategory = useAddCategory()
  const removeCategory = useRemoveCategory()
  const addSize = useAddSize()
  const removeSize = useRemoveSize()

  const [categoryName, setCategoryName] = useState('')
  const [sizeLabel, setSizeLabel] = useState('')
  const [sizeWidth, setSizeWidth] = useState('')
  const [sizeHeight, setSizeHeight] = useState('')

  function handleAddCategory(e: FormEvent) {
    e.preventDefault()
    const name = categoryName.trim()
    if (!name) return
    addCategory.mutate(name)
    setCategoryName('')
  }

  function handleAddSize(e: FormEvent) {
    e.preventDefault()
    const label = sizeLabel.trim()
    const width = Number(sizeWidth)
    const height = Number(sizeHeight)
    if (!label || !width || !height) return
    addSize.mutate({ label, width, height })
    setSizeLabel('')
    setSizeWidth('')
    setSizeHeight('')
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card ticks className="p-5">
        <div className="flex items-center gap-2">
          <Tags className="size-4 text-accent" />
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Categories
          </h3>
        </div>
        <form onSubmit={handleAddCategory} className="mt-4 flex gap-2">
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="New category name"
            className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
          />
          <Button type="submit" size="sm" variant="secondary">
            <Plus className="size-3.5" />
            Add
          </Button>
        </form>
        <ul className="mt-4 space-y-1.5">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between border border-ink/10 px-3 py-2 text-sm dark:border-paper/15"
            >
              {c.name}
              <button
                type="button"
                onClick={() => removeCategory.mutate(c.id)}
                title="Remove category"
                className="text-ink/40 hover:text-brand-error dark:text-paper/40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card ticks className="p-5">
        <div className="flex items-center gap-2">
          <Tags className="size-4 text-accent" />
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Sizes
          </h3>
        </div>
        <form onSubmit={handleAddSize} className="mt-4 space-y-2">
          <input
            value={sizeLabel}
            onChange={(e) => setSizeLabel(e.target.value)}
            placeholder="Label, e.g. LED 12 × 24 ft"
            className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
          />
          <div className="flex gap-2">
            <input
              value={sizeWidth}
              onChange={(e) => setSizeWidth(e.target.value)}
              type="number"
              min="1"
              placeholder="Width (ft)"
              className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
            />
            <input
              value={sizeHeight}
              onChange={(e) => setSizeHeight(e.target.value)}
              type="number"
              min="1"
              placeholder="Height (ft)"
              className="w-full border-b border-ink/20 bg-transparent py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
            />
            <Button type="submit" size="sm" variant="secondary" className="shrink-0">
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </form>
        <ul className="mt-4 space-y-1.5">
          {sizes.map((sz) => (
            <li
              key={sz.id}
              className="flex items-center justify-between border border-ink/10 px-3 py-2 text-sm dark:border-paper/15"
            >
              {sz.label}
              <button
                type="button"
                onClick={() => removeSize.mutate(sz.id)}
                title="Remove size"
                className="text-ink/40 hover:text-brand-error dark:text-paper/40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
