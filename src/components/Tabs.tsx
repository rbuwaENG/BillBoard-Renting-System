import { cn } from '@/lib/utils'

export interface TabItem {
  key: string
  label: string
}

interface TabsProps {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
}

export function Tabs({ items, active, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-6 overflow-x-auto border-b border-ink/10 font-mono text-xs tracking-widest uppercase dark:border-paper/10">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            'border-b-2 border-transparent py-3 whitespace-nowrap text-ink/50 transition-colors hover:text-ink dark:text-paper/50 dark:hover:text-paper',
            active === item.key && 'border-accent text-ink dark:text-paper',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
