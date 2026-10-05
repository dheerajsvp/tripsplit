import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addExpense, ApiError, getGroup } from '../api/client'
import Avatar from '../components/Avatar'
import BackLink from '../components/BackLink'
import Button from '../components/Button'
import Card from '../components/Card'
import { formatPaise, parseRupeesToPaise } from '../lib/money'
import { splitEqually } from '../lib/split'
import type { Group } from '../types'

const INPUT_CLASSES =
  'mt-1.5 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100'

export default function AddExpensePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [group, setGroup] = useState<Group | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState<number | ''>('')
  const [splitBetween, setSplitBetween] = useState<Set<number>>(new Set())

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    setIsLoading(true)
    setLoadError(null)
    getGroup(code)
      .then((fetchedGroup) => {
        setGroup(fetchedGroup)
        setPaidBy(fetchedGroup.members[0]?.id ?? '')
        setSplitBetween(new Set(fetchedGroup.members.map((member) => member.id)))
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load this trip.'))
      .finally(() => setIsLoading(false))
  }, [code])

  const amountPaise = useMemo(() => parseRupeesToPaise(amount), [amount])
  const preview = useMemo(() => {
    if (!amountPaise || splitBetween.size === 0) return null
    return splitEqually(amountPaise, [...splitBetween])
  }, [amountPaise, splitBetween])

  function toggleMember(memberId: number) {
    setSplitBetween((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!code || paidBy === '') return

    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await addExpense(code, {
        paid_by: paidBy,
        amount,
        description,
        split_between: [...splitBetween],
      })
      navigate(`/t/${code}`)
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not add the expense. Please try again.',
      )
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">Loading…</main>
    )
  }

  if (loadError || !group) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 text-center text-red-600">
        {loadError ?? 'Trip not found.'}
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <BackLink to={`/t/${code}`}>Back to {group.name}</BackLink>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">Add expense</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-gray-700">
            Description
          </label>
          <input
            id="description"
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT_CLASSES}
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-semibold text-gray-700">
            Amount (₹)
          </label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT_CLASSES}
          />
        </div>

        <div>
          <label htmlFor="paid-by" className="block text-sm font-semibold text-gray-700">
            Paid by
          </label>
          <select
            id="paid-by"
            required
            value={paidBy}
            onChange={(e) => setPaidBy(Number(e.target.value))}
            className={INPUT_CLASSES}
          >
            {group.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-sm font-semibold text-gray-700">Split between</span>
          <div className="mt-2 space-y-2">
            {group.members.map((member) => {
              const share = preview?.[member.id]
              return (
                <label key={member.id}>
                  <Card className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={splitBetween.has(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="h-4 w-4 shrink-0 accent-emerald-600"
                    />
                    <Avatar name={member.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                      {member.name}
                    </span>
                    {share !== undefined && (
                      <span className="shrink-0 text-sm font-semibold text-emerald-600">
                        {formatPaise(share)}
                      </span>
                    )}
                  </Card>
                </label>
              )
            })}
          </div>
        </div>

        {submitError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting || splitBetween.size === 0} className="w-full">
          {isSubmitting ? 'Adding expense…' : 'Add expense'}
        </Button>
      </form>
    </main>
  )
}
