import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, deleteExpense, deleteGroup, getGroup, listExpenses } from '../api/client'
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
      <Link to="/" className="text-sm text-gray-500">
        ← All trips
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-gray-900">{group.name}</h1>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900"
        >
          {copied ? 'Copied!' : 'Copy share link'}
        </button>
        <a
          href={whatsAppShareUrl}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-900"
        >
          Share on WhatsApp
        </a>
      </div>

      <Link
        to={`/t/${code}/settle`}
        className="mt-2 block rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-900"
      >
        Balances & Settle Up
      </Link>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-700">Members</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {group.members.map((member) => (
            <li
              key={member.id}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700"
            >
              {member.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-sm font-medium text-gray-700">
            Total spent: {formatPaise(totalSpentPaise)}
          </h2>
          <Link
            to={`/t/${code}/add`}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + Add expense
          </Link>
        </div>

        {expenses.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No expenses yet — add your first one.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
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
                  className="shrink-0 text-xs font-medium text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={handleDeleteTrip}
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600"
        >
          Delete trip
        </button>
      </section>
    </main>
  )
}
