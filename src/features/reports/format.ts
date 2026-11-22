/** "45 s", "12 min", "3 h 5 min", "2 d 4 h": medians span seconds to days. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const minutes = Math.round(s / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`
  const days = Math.floor(hours / 24)
  return hours % 24 === 0 ? `${days} d` : `${days} d ${hours % 24} h`
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

/** Local calendar days → the UTC instants the API filters on: [start of `from`, start of the day after `to`). */
export function periodFromDays(fromDay: string, toDay: string): { from: string; to: string } | null {
  if (!fromDay || !toDay || fromDay > toDay) return null
  const from = new Date(`${fromDay}T00:00:00`)
  const to = new Date(`${toDay}T00:00:00`)
  to.setDate(to.getDate() + 1)
  return Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) ? null : { from: from.toISOString(), to: to.toISOString() }
}

export function dayString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
