import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, createGroup } from '../api/client'
import { addRecentTrip, getRecentTrips } from '../lib/recentTrips'

interface MemberRow {
  name: string
  upi_id: string
}

function emptyMember(): MemberRow {
  return { name: '', upi_id: '' }
}

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
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">TripSplit</h1>
      <p className="mt-1 text-sm text-gray-500">Split group expenses and settle up with UPI.</p>

      {recentTrips.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-gray-700">Your trips</h2>
          <ul className="mt-2 space-y-2">
            {recentTrips.map((trip) => (
              <li key={trip.shareCode}>
                <Link
                  to={`/t/${trip.shareCode}`}
                  className="block truncate rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 active:bg-gray-50"
                >
                  {trip.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label htmlFor="trip-name" className="block text-sm font-medium text-gray-700">
            Trip name
          </label>
          <input
            id="trip-name"
            type="text"
            required
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700">Members</span>
          <div className="mt-2 space-y-3">
            {members.map((member, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    required
                    value={member.name}
                    onChange={(e) => updateMember(index, 'name', e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-gray-500 focus:outline-none sm:flex-1"
                  />
                  <input
                    type="text"
                    required
                    value={member.upi_id}
                    onChange={(e) => updateMember(index, 'upi_id', e.target.value)}
                    placeholder="UPI ID (name@bank)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-gray-500 focus:outline-none sm:flex-1"
                  />
                </div>
                {members.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeMemberRow(index)}
                    className="mt-2 text-xs font-medium text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMemberRow}
            className="mt-3 text-sm font-medium text-blue-600"
          >
            + Add member
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Creating trip…' : 'Create trip'}
        </button>
      </form>
    </main>
  )
}
