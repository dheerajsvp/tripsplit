import type {
  AddMemberRequest,
  BalancesResponse,
  CreateExpenseRequest,
  CreateGroupRequest,
  CreateSettlementRequest,
  Expense,
  Group,
  Member,
  Settlement,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(extractErrorMessage(body))
    this.status = status
    this.body = body
  }
}

function extractErrorMessage(body: unknown): string {
  if (body && typeof body === 'object') {
    for (const value of Object.values(body as Record<string, unknown>)) {
      const message = Array.isArray(value) ? value[0] : value
      if (typeof message === 'string') return message
    }
  }
  return 'Something went wrong. Please try again.'
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(response.status, data)
  }

  return data as T
}

export function createGroup(payload: CreateGroupRequest): Promise<Group> {
  return request('/groups/', { method: 'POST', body: JSON.stringify(payload) })
}

export function getGroup(shareCode: string): Promise<Group> {
  return request(`/groups/${shareCode}/`)
}

export function deleteGroup(shareCode: string): Promise<void> {
  return request(`/groups/${shareCode}/`, { method: 'DELETE' })
}

export function addMember(shareCode: string, payload: AddMemberRequest): Promise<Member> {
  return request(`/groups/${shareCode}/members/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listExpenses(shareCode: string): Promise<Expense[]> {
  return request(`/groups/${shareCode}/expenses/`)
}

export function addExpense(shareCode: string, payload: CreateExpenseRequest): Promise<Expense> {
  return request(`/groups/${shareCode}/expenses/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteExpense(shareCode: string, expenseId: number): Promise<void> {
  return request(`/groups/${shareCode}/expenses/${expenseId}/`, { method: 'DELETE' })
}

export function listSettlements(shareCode: string): Promise<Settlement[]> {
  return request(`/groups/${shareCode}/settlements/`)
}

export function addSettlement(
  shareCode: string,
  payload: CreateSettlementRequest,
): Promise<Settlement> {
  return request(`/groups/${shareCode}/settlements/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getBalances(shareCode: string): Promise<BalancesResponse> {
  return request(`/groups/${shareCode}/balances/`)
}
