import { ChevronLeft, ChevronRight, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FileDropzone } from '@/components'
import { BillboardPhoto } from '@/features/billboards/BillboardPhoto'
import { IMAGE_ACCEPT } from '@/lib/fileKind'
import { cn } from '@/lib/utils'
import {
  imageFileError,
  itemSrc,
  makeCover,
  moveItem,
  newItems,
  removeAt,
  type ImageItem,
} from './imageManager'

interface BillboardImageManagerProps {
  items: ImageItem[]
  onChange: (items: ImageItem[]) => void
  disabled?: boolean
}

const iconButtonClass =
  'flex size-6 items-center justify-center border border-ink/15 bg-paper text-ink/70 hover:border-ink/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 dark:border-paper/20 dark:bg-ink-soft dark:text-paper/70 dark:hover:text-paper'

// Ordered photo list for a listing: thumbnails of stored and newly picked
// images, with move left/right, set-as-cover (= first) and remove. New files
// are only uploaded when the form is saved.
export function BillboardImageManager({
  items,
  onChange,
  disabled = false,
}: BillboardImageManagerProps) {
  const [error, setError] = useState<string | null>(null)

  function addFiles(files: File[]) {
    const accepted: File[] = []
    const problems: string[] = []
    for (const file of files) {
      const problem = imageFileError(file)
      if (problem) problems.push(problem)
      else accepted.push(file)
    }
    setError(problems.length > 0 ? problems.join(' ') : null)
    if (accepted.length > 0) onChange([...items, ...newItems(accepted)])
  }

  return (
    <div>
      {items.length > 0 && (
        <ol className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item, i) => {
            const position = `image ${i + 1} of ${items.length}`
            return (
              <li
                key={item.key}
                className={cn(
                  'border',
                  i === 0
                    ? 'border-accent'
                    : 'border-ink/10 dark:border-paper/15',
                )}
              >
                <div className="relative">
                  <BillboardPhoto
                    src={itemSrc(item)}
                    alt={`Listing ${position}${i === 0 ? ' (cover)' : ''}`}
                    className="aspect-[4/3] w-full"
                    markClassName="size-6"
                  />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 bg-accent px-1 py-0.5 font-mono text-[9px] tracking-widest text-paper uppercase">
                      Cover
                    </span>
                  )}
                  {item.kind === 'new' && (
                    <span className="absolute top-1 right-1 bg-ink/70 px-1 py-0.5 font-mono text-[9px] tracking-widest text-paper uppercase">
                      New
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 p-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={disabled || i === 0}
                      onClick={() => onChange(moveItem(items, i, i - 1))}
                      aria-label={`Move ${position} left`}
                      title="Move left"
                      className={iconButtonClass}
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={disabled || i === items.length - 1}
                      onClick={() => onChange(moveItem(items, i, i + 1))}
                      aria-label={`Move ${position} right`}
                      title="Move right"
                      className={iconButtonClass}
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={disabled || i === 0}
                      onClick={() => onChange(makeCover(items, i))}
                      aria-label={`Set ${position} as cover`}
                      title="Set as cover"
                      className={iconButtonClass}
                    >
                      <Star className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(removeAt(items, i))}
                      aria-label={`Remove ${position}`}
                      title="Remove"
                      className={cn(iconButtonClass, 'hover:text-brand-error')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <FileDropzone
        accept={IMAGE_ACCEPT}
        multiple
        disabled={disabled}
        // Size/type are checked per file in addFiles, so one oversized pick
        // doesn't throw away the rest of the selection.
        hint="JPG, PNG, WebP, GIF or AVIF up to 5MB each · the first photo is the cover"
        onFilesSelected={addFiles}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-brand-error">
          {error}
        </p>
      )}
    </div>
  )
}
