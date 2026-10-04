import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addSettlement, ApiError, getBalances, listSettlements } from '../api/client'
import { formatPaise, formatSignedPaise } from '../lib/money'
import { buildWhatsAppReminderLink, isMobileDevice } from '../lib/upi'
import type { BalancesResponse, Settlement, SuggestedPayment } from '../types'

function PaymentCard({
  payment,
  groupName,
  onMarkPaid,
}: {
  payment: SuggestedPayment
  groupName: string
  onMarkPaid: (payment: SuggestedPayment) => void
}) {
  const [isMobile] = useState(() => isMobileDevice())
  const [copied, setCopied] = useState(false)

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-900">
        {payment.from_name} pays {payment.to_name} {formatPaise(payment.amount_paise)}
      </p>

      {isMobile ? (
        <a
          href={payment.upi_link}
          className="mt-3 block rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white"
        >
          Pay {formatPaise(payment.amount_paise)} via UPI
        </a>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-1">
          <QRCodeSVG value={payment.upi_link} size={160} />
          <p className="text-xs text-gray-500">Scan with any UPI app</p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(payment.to_upi_id)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-900"
        >
          {copied ? 'Copied!' : 'Copy UPI ID'}
        </button>
        <a
          href={buildWhatsAppReminderLink(
            payment.from_name,
            payment.amount_paise,
            groupName,
            payment.upi_link,
          )}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-900"
        >
          Send reminder
        </a>
      </div>

      <button
        type="button"
        onClick={() => onMarkPaid(payment)}
        className="mt-2 w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white"
      >
        Mark as paid
      </button>
    </div>
  )
}

export default function SettleUpPage() {
  const { code } = useParams<{ code: string }>()
  const [balances, setBalances] = useState<BalancesResponse | null>(null)
  const [settlements, setSettlements] = useState<Settlement[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(() => {
    if (!code) return
    setIsLoading(true)
    setError(null)
    Promise.all([getBalances(code), listSettlements(code)])
      .then(([fetchedBalances, fetchedSettlements]) => {
        setBalances(fetchedBalances)
        setSettlements(fetchedSettlements)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this trip.'))
      .finally(() => setIsLoading(false))
  }, [code])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleMarkPaid(payment: SuggestedPayment) {
    if (!code) return
    if (
      !window.confirm(
        `Mark "${payment.from_name} pays ${payment.to_name} ${formatPaise(payment.amount_paise)}" as paid?`,
      )
    ) {
      return
    }
    try {
      await addSettlement(code, {
        from_member: payment.from_member,
        to_member: payment.to_member,
        amount: payment.amount,
      })
      loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this payment.')
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading balances…
      </main>
    )
  }

  if (error || !balances || !settlements) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 text-center text-red-600">
        {error ?? 'Trip not found.'}
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <Link to={`/t/${code}`} className="text-sm text-gray-500">
        ← Back to {balances.group}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">Balances & Settle Up</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-700">Balances</h2>
        <ul className="mt-2 space-y-2">
          {balances.balances.map((balance) => (
            <li
              key={balance.member_id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-gray-900">{balance.name}</span>
              <span
                className={
                  balance.balance_paise > 0
                    ? 'shrink-0 text-sm font-medium text-green-600'
                    : balance.balance_paise < 0
                      ? 'shrink-0 text-sm font-medium text-red-600'
                      : 'shrink-0 text-sm font-medium text-gray-500'
                }
              >
                {formatSignedPaise(balance.balance_paise)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-700">Suggested payments</h2>
        {balances.is_settled ? (
          <p className="mt-4 text-sm text-gray-500">Everyone is settled up.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {balances.suggested_payments.map((payment) => (
              <PaymentCard
                key={`${payment.from_member}-${payment.to_member}`}
                payment={payment}
                groupName={balances.group}
                onMarkPaid={handleMarkPaid}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-700">Settlement history</h2>
        {settlements.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No payments recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {settlements.map((settlement) => (
              <li
                key={settlement.id}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
              >
                {settlement.from_member_name} paid {settlement.to_member_name}{' '}
                {formatPaise(settlement.amount_paise)}
                <span className="block text-xs text-gray-400">
                  {new Date(settlement.paid_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
