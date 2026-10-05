import { IndianRupee, Link2, Plus, Receipt, Scale, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, deleteExpense, deleteGroup, getGroup, listExpenses } from '../api/client'
import Avatar from '../components/Avatar'
import BackLink from '../components/BackLink'
import { buttonClasses } from '../components/Button'
import Card from '../components/Card'
import { formatPaise } from '../lib/money'
import { removeRecentTrip } from '../lib/recentTrips'
import type { Expense, Group } from '../types'

export default function TripDashboardPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null>(null)
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const loadTrip = useCallback(() => {
    if (!code) return
    setIsLoading(true)
    setError(null)
    Promise.all([getGroup(code), listExpenses(code)])
      .then(([fetchedGroup, fetchedExpenses]) => {
        setGroup(fetchedGroup)
        setExpenses(fetchedExpenses)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this trip.'))
      .finally(() => setIsLoading(false))
  }, [code])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  async function handleDelete(expenseId: number) {
    if (!code) return
    if (!window.confirm('Delete this expense?')) return
    try {
      await deleteExpense(code, expenseId)
      setExpenses((prev) => prev?.filter((expense) => expense.id !== expenseId) ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this expense.')
    }
  }

  async function handleDeleteTrip() {
    if (!code || !group) return
    if (
      !window.confirm(
        `Delete "${group.name}" permanently? This removes all its expenses and settlements too — this can't be undone.`,
      )
    ) {
      return
    }
    try {
      await deleteGroup(code)
      removeRecentTrip(code)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this trip.')
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading trip…
      </main>
    )
  }

  if (error || !group || !expenses) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 text-center text-red-600">
        {error ?? 'Trip not found.'}
      </main>
    )
  }

  const shareUrl = `${window.location.origin}/t/${group.share_code}`
  const totalSpentPaise = expenses.reduce((sum, expense) => sum + expense.amount_paise, 0)
  const whatsAppShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Join "${group.name}" on TripSplit to track our shared expenses: ${shareUrl}`,
  )}`

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <BackLink to="/">All trips</BackLink>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">{group.name}</h1>

      <Card className="mt-4 flex items-center gap-4 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
          <IndianRupee className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium text-emerald-100">Total spent</p>
          <p className="text-2xl font-extrabold tracking-tight">{formatPaise(totalSpentPaise)}</p>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className={buttonClasses('outline', 'sm', 'flex-col gap-1 py-3')}
        >
          <Link2 className="h-4 w-4" />
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <a
          href={whatsAppShareUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonClasses('outline', 'sm', 'flex-col gap-1 py-3')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.26 4.9L2 22l5.25-1.38a9.96 9.96 0 0 0 4.79 1.22h.01c5.52 0 10-4.48 10-10s-4.49-9.84-10.01-9.84Zm0 18.17h-.01a8.3 8.3 0 0 1-4.24-1.16l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.27-4.4c0-4.58 3.73-8.3 8.32-8.3 2.22 0 4.31.87 5.88 2.44a8.25 8.25 0 0 1 2.43 5.87c0 4.58-3.73 8.26-8.32 8.26Zm4.54-6.19c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.8-.78.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.21-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.38 1.01 2.54c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
          </svg>
          WhatsApp
        </a>
        <Link to={`/t/${code}/settle`} className={buttonClasses('outline', 'sm', 'flex-col gap-1 py-3')}>
          <Scale className="h-4 w-4" />
          Settle Up
        </Link>
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-700">Members</h2>
        <ul className="mt-3 flex flex-wrap gap-3">
          {group.members.map((member) => (
            <li key={member.id} className="flex flex-col items-center gap-1">
              <Avatar name={member.name} />
              <span className="max-w-16 truncate text-xs text-gray-600">{member.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Expenses</h2>
          <Link to={`/t/${code}/add`} className={buttonClasses('primary', 'sm')}>
            <Plus className="h-3.5 w-3.5" />
            Add expense
          </Link>
        </div>

        {expenses.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No expenses yet — add your first one.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <Card className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Receipt className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {expense.description}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {expense.paid_by_name} paid {formatPaise(expense.amount_paise)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(expense.id)}
                    aria-label={`Delete ${expense.description}`}
                    className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={handleDeleteTrip}
          className={`w-full ${buttonClasses('danger')}`}
        >
          Delete trip
        </button>
      </section>
    </main>
  )
}
