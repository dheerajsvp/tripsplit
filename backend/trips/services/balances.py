"""Pure-Python debt-splitting and settlement math. No Django imports here —
this stays unit-testable in isolation from the database and the web layer.
"""

import heapq
from dataclasses import dataclass
from typing import Dict, Iterable, List


@dataclass(frozen=True)
class ExpenseShareInput:
    member_id: int
    share_paise: int


@dataclass(frozen=True)
class ExpenseInput:
    paid_by: int
    amount_paise: int
    shares: List[ExpenseShareInput]


@dataclass(frozen=True)
class SettlementInput:
    from_member: int
    to_member: int
    amount_paise: int


@dataclass(frozen=True)
class Transfer:
    from_member: int
    to_member: int
    amount_paise: int


def split_equally(total_paise: int, member_ids: Iterable[int]) -> Dict[int, int]:
    """Split total_paise evenly across member_ids.

    Leftover paise (from the remainder of the division) go one each to the
    members with the lowest ids, so the result is deterministic no matter
    what order member_ids is given in.
    """
    ids = list(member_ids)
    if not ids:
        raise ValueError("At least one member is required to split an amount.")
    if total_paise <= 0:
        raise ValueError("Amount to split must be positive.")

    base, remainder = divmod(total_paise, len(ids))
    sorted_ids = sorted(ids)
    return {
        member_id: base + 1 if index < remainder else base
        for index, member_id in enumerate(sorted_ids)
    }


def compute_net_balances(
    expenses: Iterable[ExpenseInput],
    settlements: Iterable[SettlementInput],
    member_ids: Iterable[int],
) -> Dict[int, int]:
    """Net position per member: positive = is owed money, negative = owes money.

    Every id in member_ids is present in the result, even with no activity.
    """
    balances = {member_id: 0 for member_id in member_ids}

    for expense in expenses:
        shares_total = sum(share.share_paise for share in expense.shares)
        if shares_total != expense.amount_paise:
            raise ValueError(
                f"Expense shares sum to {shares_total} paise, "
                f"expected {expense.amount_paise} paise."
            )
        balances[expense.paid_by] = balances.get(expense.paid_by, 0) + expense.amount_paise
        for share in expense.shares:
            balances[share.member_id] = balances.get(share.member_id, 0) - share.share_paise

    for settlement in settlements:
        balances[settlement.from_member] = (
            balances.get(settlement.from_member, 0) + settlement.amount_paise
        )
        balances[settlement.to_member] = (
            balances.get(settlement.to_member, 0) - settlement.amount_paise
        )

    return balances


def simplify_debts(balances: Dict[int, int]) -> List[Transfer]:
    """Minimal-ish list of payments that settles every balance to zero.

    Greedy two-max-heap approach: repeatedly match the biggest creditor with
    the biggest debtor. Not guaranteed globally optimal (that's NP-hard), but
    gives at most n-1 transfers for n non-zero members. Member id is used as
    a heap tie-breaker so the output is deterministic.
    """
    if sum(balances.values()) != 0:
        raise ValueError(f"Balances must sum to zero, got {sum(balances.values())}.")

    creditors = [(-balance, member_id) for member_id, balance in balances.items() if balance > 0]
    debtors = [(balance, member_id) for member_id, balance in balances.items() if balance < 0]
    heapq.heapify(creditors)
    heapq.heapify(debtors)

    transfers: List[Transfer] = []
    while creditors and debtors:
        neg_credit, creditor_id = heapq.heappop(creditors)
        debt, debtor_id = heapq.heappop(debtors)
        credit = -neg_credit
        amount = min(credit, -debt)

        transfers.append(
            Transfer(from_member=debtor_id, to_member=creditor_id, amount_paise=amount)
        )

        remaining_credit = credit - amount
        remaining_debt = debt + amount
        if remaining_credit > 0:
            heapq.heappush(creditors, (-remaining_credit, creditor_id))
        if remaining_debt < 0:
            heapq.heappush(debtors, (remaining_debt, debtor_id))

    return transfers
