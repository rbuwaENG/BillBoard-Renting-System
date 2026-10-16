import { Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  accept?: string
  maxSizeBytes?: number
  multiple?: boolean
  disabled?: boolean
  hint?: string
  onFilesSelected: (files: File[]) => void
  onError?: (message: string) => void
}

export function FileDropzone({
  accept,
  maxSizeBytes,
  multiple = false,
  disabled = false,
  hint,
  onFilesSelected,
  onError,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndEmit(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    if (maxSizeBytes) {
      const oversized = files.find((f) => f.size > maxSizeBytes)
      if (oversized) {
        onError?.(
          `"${oversized.name}" is too large (max ${Math.round(maxSizeBytes / (1024 * 1024))}MB).`,
        )
        return
      }
    }
    onFilesSelected(multiple ? files : [files[0]])
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    validateAndEmit(e.dataTransfer.files)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 border border-dashed px-4 py-6 text-center transition-colors',
        disabled
          ? 'cursor-not-allowed border-ink/10 opacity-40 dark:border-paper/10'
          : 'cursor-pointer border-ink/20 hover:border-ink/35 dark:border-paper/20 dark:hover:border-paper/35',
        dragging && !disabled && 'border-accent bg-accent/5',
      )}
    >
      <Upload className="size-5 text-ink/40 dark:text-paper/40" />
      <p className="font-mono text-[11px] tracking-widest text-ink/60 uppercase dark:text-paper/60">
        Drag files here or click to browse
      </p>
      {hint && <p className="font-mono text-[10px] text-ink/40 dark:text-paper/40">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) validateAndEmit(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
