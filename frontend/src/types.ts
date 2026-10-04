export interface Member {
  id: number
  name: string
  upi_id: string
}

export interface Group {
  id: number
  name: string
  share_code: string
  created_at: string
  members: Member[]
}

export interface ExpenseShare {
  member: number
  member_name: string
  share_paise: number
  share: string
}

export interface Expense {
  id: number
  paid_by: number
  paid_by_name: string
  amount_paise: number
  amount_display: string
  description: string
  shares: ExpenseShare[]
  created_at: string
}

export interface Settlement {
  id: number
  from_member: number
  from_member_name: string
  to_member: number
  to_member_name: string
  amount_paise: number
  amount_display: string
  paid_at: string
}

export interface Balance {
  member_id: number
  name: string
  balance_paise: number
  balance: string
}

export interface SuggestedPayment {
  from_member: number
  from_name: string
  to_member: number
  to_name: string
  to_upi_id: string
  amount_paise: number
  amount: string
  upi_link: string
}

export interface BalancesResponse {
  group: string
  total_spent: string
  is_settled: boolean
  balances: Balance[]
  suggested_payments: SuggestedPayment[]
}

export interface CreateGroupRequest {
  name: string
  members: { name: string; upi_id: string }[]
}

export interface AddMemberRequest {
  name: string
  upi_id: string
}

export interface CreateExpenseRequest {
  paid_by: number
  amount: string
  description: string
  split_between?: number[]
}

export interface CreateSettlementRequest {
  from_member: number
  to_member: number
  amount: string
}
