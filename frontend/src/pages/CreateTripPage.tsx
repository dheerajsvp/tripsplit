import { MapPinned, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, createGroup } from '../api/client'
import Avatar from '../components/Avatar'
import Button from '../components/Button'
import Card from '../components/Card'
import Logo from '../components/Logo'
import { addRecentTrip, getRecentTrips } from '../lib/recentTrips'

interface MemberRow {
  name: string
  upi_id: string
}

function emptyMember(): MemberRow {
  return { name: '', upi_id: '' }
}

const INPUT_CLASSES =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100'

export default function CreateTripPage() {
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [members, setMembers] = useState<MemberRow[]>([emptyMember(), emptyMember()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recentTrips = getRecentTrips()

  function updateMember(index: number, field: keyof MemberRow, value: string) {
    setMembers((prev) =>
      prev.map((member, i) => (i === index ? { ...member, [field]: value } : member)),
    )
  }

  function addMemberRow() {
    setMembers((prev) => [...prev, emptyMember()])
  }

  function removeMemberRow(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const group = await createGroup({ name: tripName, members })
      addRecentTrip({ shareCode: group.share_code, name: group.name })
      navigate(`/t/${group.share_code}`)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not create the trip. Please try again.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-10">
      <Logo />
      <p className="mt-2 text-sm text-gray-500">Split group expenses and settle up with UPI.</p>

      {recentTrips.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700">Your trips</h2>
          <ul className="mt-3 space-y-2">
            {recentTrips.map((trip) => (
              <li key={trip.shareCode}>
                <Link to={`/t/${trip.shareCode}`}>
                  <Card className="flex items-center gap-3 transition-shadow hover:shadow-md">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <MapPinned className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-medium text-gray-900">
                      {trip.name}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="trip-name" className="block text-sm font-semibold text-gray-700">
            Trip name
          </label>
          <input
            id="trip-name"
            type="text"
            required
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            className={`mt-1.5 ${INPUT_CLASSES}`}
          />
        </div>

        <div>
          <span className="block text-sm font-semibold text-gray-700">Members</span>
          <div className="mt-2 space-y-3">
            {members.map((member, index) => (
              <Card key={index} className="flex items-start gap-3">
                <div className="mt-2.5">
                  <Avatar name={member.name || '?'} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      required
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      placeholder="Name"
                      className={`${INPUT_CLASSES} sm:flex-1`}
                    />
                    <input
                      type="text"
                      required
                      value={member.upi_id}
                      onChange={(e) => updateMember(index, 'upi_id', e.target.value)}
                      placeholder="UPI ID (name@bank)"
                      className={`${INPUT_CLASSES} sm:flex-1`}
                    />
                  </div>
                  {members.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeMemberRow(index)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <button
            type="button"
            onClick={addMemberRow}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add member
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating trip…' : 'Create trip'}
        </Button>
      </form>
    </main>
  )
}
