import { ArrowRight, CheckCircle2, History, PartyPopper } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { addSettlement, ApiError, getBalances, listSettlements } from '../api/client'
import Avatar from '../components/Avatar'
import BackLink from '../components/BackLink'
import { buttonClasses } from '../components/Button'
import Card from '../components/Card'
import { formatPaise, formatSignedPaise } from '../lib/money'
import { buildWhatsAppReminderLink, isMobileDevice } from '../lib/upi'
import type { BalancesResponse, Settlement, SuggestedPayment } from '../types'

function BalancePill({ balancePaise }: { balancePaise: number }) {
  const classes =
    balancePaise > 0
      ? 'bg-emerald-50 text-emerald-700'
      : balancePaise < 0
        ? 'bg-red-50 text-red-700'
        : 'bg-gray-100 text-gray-600'
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {formatSignedPaise(balancePaise)}
    </span>
  )
}

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
    <Card>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-1">
          <Avatar name={payment.from_name} size="sm" />
          <span className="max-w-14 truncate text-[11px] text-gray-500">{payment.from_name}</span>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
        <div className="flex flex-col items-center gap-1">
          <Avatar name={payment.to_name} size="sm" />
          <span className="max-w-14 truncate text-[11px] text-gray-500">{payment.to_name}</span>
        </div>
        <p className="ml-auto text-lg font-extrabold text-gray-900">
          {formatPaise(payment.amount_paise)}
        </p>
      </div>

      {isMobile ? (
        <a href={payment.upi_link} className={`mt-4 w-full ${buttonClasses('primary')}`}>
          Pay {formatPaise(payment.amount_paise)} via UPI
        </a>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-gray-50 py-4">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <QRCodeSVG value={payment.upi_link} size={144} />
          </div>
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
          className={`flex-1 ${buttonClasses('outline', 'sm')}`}
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
          className={`flex-1 ${buttonClasses('outline', 'sm')}`}
        >
          Send reminder
        </a>
      </div>

      <button
        type="button"
        onClick={() => onMarkPaid(payment)}
        className={`mt-2 w-full ${buttonClasses('secondary', 'sm')}`}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Mark as paid
      </button>
    </Card>
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
      <BackLink to={`/t/${code}`}>Back to {balances.group}</BackLink>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">
        Balances & Settle Up
      </h1>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-700">Balances</h2>
        <ul className="mt-3 space-y-2">
          {balances.balances.map((balance) => (
            <li key={balance.member_id}>
              <Card className="flex items-center gap-3">
                <Avatar name={balance.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                  {balance.name}
                </span>
                <BalancePill balancePaise={balance.balance_paise} />
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-700">Suggested payments</h2>
        {balances.is_settled ? (
          <Card className="mt-3 flex flex-col items-center gap-2 py-8 text-center">
            <PartyPopper className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-gray-700">Everyone is settled up!</p>
          </Card>
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
        <h2 className="text-sm font-semibold text-gray-700">Settlement history</h2>
        {settlements.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No payments recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {settlements.map((settlement) => (
              <li key={settlement.id}>
                <Card className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <History className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {settlement.from_member_name} paid {settlement.to_member_name}{' '}
                      {formatPaise(settlement.amount_paise)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(settlement.paid_at).toLocaleString()}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
