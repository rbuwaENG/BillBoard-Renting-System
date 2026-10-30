import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import {
  addDays,
  addMonths,
  buildMonthGrid,
  compareMonths,
  formatLongDate,
  formatMonthTitle,
  formatShortDateRange,
  isBooked,
  monthOf,
  parseISODate,
  selectDay,
  shiftMonthKeepDay,
  type BookedRange,
  type DateSelection,
} from './availability'
import {
  bookingDays,
  MAX_ADVANCE_MESSAGE,
  MAX_BOOKING_DAYS,
  MAX_LENGTH_MESSAGE,
  maxEndDate,
  maxStartDate,
  todayISO,
} from './dateRange'

const WEEKDAYS = [
  ['Su', 'Sunday'],
  ['Mo', 'Monday'],
  ['Tu', 'Tuesday'],
  ['We', 'Wednesday'],
  ['Th', 'Thursday'],
  ['Fr', 'Friday'],
  ['Sa', 'Saturday'],
] as const

interface AvailabilityCalendarProps {
  value: DateSelection
  onChange: (value: DateSelection) => void
  bookedRanges: BookedRange[]
  // Injected by tests; defaults to the viewer's local today.
  today?: string
  label?: string
  bookedLegend?: string
  compact?: boolean
  // Extra line under the legend (e.g. "availability unavailable").
  notice?: ReactNode
}

// Month-grid range picker. Past and booked days can't be picked, and a range
// that would run across a booked day is rejected (the same rule the server
// enforces), as are starts more than 365 days ahead and ranges longer than
// 365 days. Navigation stops at the last month a pick can land in. Keyboard: arrows move by day/week, Home/End to the week's
// start/end, PageUp/PageDown by month, Enter/Space picks.
export function AvailabilityCalendar({
  value,
  onChange,
  bookedRanges,
  today = todayISO(),
  label = 'Booking dates',
  bookedLegend = 'Booked',
  compact = false,
  notice,
}: AvailabilityCalendarProps) {
  const id = useId()
  const gridRef = useRef<HTMLTableElement>(null)
  const pendingFocus = useRef(false)
  const todayMonth = monthOf(today)
  const [viewMonth, setViewMonth] = useState(() =>
    value.startDate && value.startDate >= today
      ? monthOf(value.startDate)
      : todayMonth,
  )
  const [focusedDate, setFocusedDate] = useState(() =>
    value.startDate && value.startDate >= today ? value.startDate : today,
  )
  const [error, setError] = useState<string | null>(null)

  const { startDate, endDate } = value
  const latestStart = maxStartDate(today)
  // While choosing an end date the range may run up to 365 days past the
  // start; otherwise the next pick is a start date.
  const choosingEnd = !!startDate && !endDate
  const latestDay =
    choosingEnd && maxEndDate(startDate) > latestStart
      ? maxEndDate(startDate)
      : latestStart
  const lastMonth = monthOf(latestDay)

  const weeks = buildMonthGrid(viewMonth)
  const monthTitle = formatMonthTitle(viewMonth)
  const canGoPrev = compareMonths(viewMonth, todayMonth) > 0
  const canGoNext = compareMonths(viewMonth, lastMonth) < 0
  const focusInView = compareMonths(monthOf(focusedDate), viewMonth) === 0
  const tabbableDate = focusInView
    ? focusedDate
    : compareMonths(viewMonth, todayMonth) === 0
      ? today
      : weeks.flat().find((d): d is string => d !== null)!

  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focusedDate}"]`)
      ?.focus()
  }, [focusedDate, viewMonth])

  function moveFocus(next: string) {
    const clamped = next < today ? today : next > latestDay ? latestDay : next
    setFocusedDate(clamped)
    setViewMonth(monthOf(clamped))
    pendingFocus.current = true
  }

  function goMonth(delta: number) {
    const next = addMonths(viewMonth, delta)
    if (compareMonths(next, todayMonth) < 0) return
    if (compareMonths(next, lastMonth) > 0) return
    setViewMonth(next)
  }

  function handlePick(day: string) {
    setFocusedDate(day)
    if (day < today) return
    if (isBooked(day, bookedRanges)) {
      setError('That day is already booked — pick another date.')
      return
    }
    const result = selectDay(value, day, bookedRanges)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const next = result.selection
    if (next.startDate > latestStart) {
      setError(MAX_ADVANCE_MESSAGE)
      return
    }
    if (
      next.endDate &&
      bookingDays(next.startDate, next.endDate) > MAX_BOOKING_DAYS
    ) {
      setError(MAX_LENGTH_MESSAGE)
      return
    }
    setError(null)
    onChange(result.selection)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, day: string) {
    const weekday = parseISODate(day).getDay()
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => addDays(day, -weekday),
      End: () => addDays(day, 6 - weekday),
      PageUp: () => shiftMonthKeepDay(day, -1),
      PageDown: () => shiftMonthKeepDay(day, 1),
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    moveFocus(move())
  }

  const cellSize = compact ? 'size-8 text-[11px]' : 'size-9 text-xs sm:size-10'
  const hint = !startDate
    ? 'Select a start date'
    : !endDate
      ? 'Now select an end date (or the same day for one day)'
      : null

  return (
    <div className="mx-auto w-fit max-w-full">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          disabled={!canGoPrev}
          aria-label="Previous month"
          title="Previous month"
          className="flex size-8 items-center justify-center border border-ink/15 text-ink/70 hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-30 dark:border-paper/20 dark:text-paper/70 dark:hover:border-paper/50"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span
          id={`${id}-title`}
          aria-live="polite"
          className="font-mono text-xs font-semibold tracking-widest uppercase"
        >
          {monthTitle}
        </span>
        <button
          type="button"
          onClick={() => goMonth(1)}
          disabled={!canGoNext}
          aria-label="Next month"
          title="Next month"
          className="flex size-8 items-center justify-center border border-ink/15 text-ink/70 hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-30 dark:border-paper/20 dark:text-paper/70 dark:hover:border-paper/50"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <table
        ref={gridRef}
        role="grid"
        aria-label={`${label}, ${monthTitle}`}
        className="mx-auto mt-2 border-collapse"
      >
        <thead>
          <tr>
            {WEEKDAYS.map(([short, long]) => (
              <th
                key={short}
                scope="col"
                abbr={long}
                className="pb-1 text-center font-mono text-[10px] font-normal tracking-widest text-ink/40 uppercase dark:text-paper/40"
              >
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, d) => {
                if (!day) {
                  return (
                    <td key={d} role="presentation">
                      <span className={cn('block', cellSize)} />
                    </td>
                  )
                }
                const past = day < today
                const tooFar = day > latestDay
                const booked = !past && !tooFar && isBooked(day, bookedRanges)
                const unavailable = past || tooFar || booked
                const isStart = day === startDate
                const isEnd = day === endDate
                const inRange =
                  !!startDate && !!endDate && day > startDate && day < endDate
                const selected = isStart || isEnd || inRange
                const isToday = day === today
                const labelParts = [formatLongDate(day)]
                if (isToday) labelParts.push('today')
                if (booked) labelParts.push('booked')
                else if (past || tooFar) labelParts.push('unavailable')
                if (isStart && isEnd) labelParts.push('selected')
                else if (isStart) labelParts.push('start date')
                else if (isEnd) labelParts.push('end date')
                else if (inRange) labelParts.push('in selected range')
                return (
                  <td
                    key={d}
                    role="gridcell"
                    aria-selected={selected}
                    className="p-0"
                  >
                    <button
                      type="button"
                      data-date={day}
                      tabIndex={day === tabbableDate ? 0 : -1}
                      aria-label={labelParts.join(', ')}
                      aria-disabled={unavailable || undefined}
                      onClick={() => handlePick(day)}
                      onKeyDown={(e) => handleKeyDown(e, day)}
                      onFocus={() => setFocusedDate(day)}
                      className={cn(
                        'flex items-center justify-center font-mono transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-accent',
                        cellSize,
                        isStart || isEnd
                          ? 'bg-accent font-semibold text-paper'
                          : inRange
                            ? 'bg-accent/15 text-ink dark:text-paper'
                            : booked
                              ? 'cursor-not-allowed bg-ink/5 text-ink/35 line-through dark:bg-paper/5 dark:text-paper/35'
                              : past || tooFar
                                ? 'cursor-not-allowed text-ink/20 dark:text-paper/20'
                                : 'text-ink hover:bg-ink/5 dark:text-paper dark:hover:bg-paper/10',
                        isToday &&
                          !(isStart || isEnd) &&
                          'underline decoration-accent decoration-2 underline-offset-4',
                      )}
                    >
                      {parseISODate(day).getDate()}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="flex size-3.5 items-center justify-center bg-ink/5 text-[8px] text-ink/40 line-through dark:bg-paper/5 dark:text-paper/40"
          >
            8
          </span>
          {bookedLegend}
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-3.5 bg-accent" />
          Selected
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="size-3.5 border border-ink/15 opacity-40 dark:border-paper/20"
          />
          Past
        </span>
      </div>

      {notice && <div className="mt-1.5 text-[11px]">{notice}</div>}

      <div className="mt-1.5 flex items-start justify-between gap-2">
        {error ? (
          <p role="alert" className="text-xs text-brand-error">
            {error}
          </p>
        ) : (
          <p className="text-[11px] text-ink/50 dark:text-paper/50">
            {hint ?? `Selected: ${formatShortDateRange(startDate, endDate)}`}
          </p>
        )}
        {startDate && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              onChange({ startDate: '', endDate: '' })
            }}
            className="shrink-0 font-mono text-[11px] text-accent uppercase hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
