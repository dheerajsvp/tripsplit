from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Expense, Group, Settlement
from .serializers import ExpenseSerializer, GroupSerializer, MemberSerializer, SettlementSerializer
from .services.balances import (
    ExpenseInput,
    ExpenseShareInput,
    SettlementInput,
    compute_net_balances,
    simplify_debts,
)
from .services.upi import build_upi_link, paise_to_rupees_str


def _get_group(share_code):
    return get_object_or_404(Group, share_code=share_code)


class GroupListCreateView(APIView):
    def post(self, request):
        serializer = GroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)


class GroupDetailView(APIView):
    def get(self, request, share_code):
        group = _get_group(share_code)
        return Response(GroupSerializer(group).data)

    def delete(self, request, share_code):
        group = _get_group(share_code)
        with transaction.atomic():
            # Expense/Settlement PROTECT their Member foreign keys, so they
            # have to go before Member does — otherwise Group.delete()'s
            # cascade to Member would hit a ProtectedError, even though
            # every row here is about to be deleted together anyway.
            Expense.objects.filter(group=group).delete()
            Settlement.objects.filter(group=group).delete()
            group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MemberListCreateView(APIView):
    def post(self, request, share_code):
        group = _get_group(share_code)
        serializer = MemberSerializer(data=request.data, context={"group": group})
        serializer.is_valid(raise_exception=True)
        member = serializer.save(group=group)
        return Response(MemberSerializer(member).data, status=status.HTTP_201_CREATED)


class ExpenseListCreateView(APIView):
    def get(self, request, share_code):
        group = _get_group(share_code)
        expenses = group.expenses.select_related("paid_by").prefetch_related("shares__member")
        return Response(ExpenseSerializer(expenses, many=True).data)

    def post(self, request, share_code):
        group = _get_group(share_code)
        serializer = ExpenseSerializer(data=request.data, context={"group": group})
        serializer.is_valid(raise_exception=True)
        expense = serializer.save()
        expense = Expense.objects.select_related("paid_by").prefetch_related("shares__member").get(
            pk=expense.pk
        )
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


class ExpenseDetailView(APIView):
    def delete(self, request, share_code, expense_id):
        group = _get_group(share_code)
        expense = get_object_or_404(Expense, group=group, pk=expense_id)
        expense.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SettlementListCreateView(APIView):
    def get(self, request, share_code):
        group = _get_group(share_code)
        settlements = group.settlements.select_related("from_member", "to_member")
        return Response(SettlementSerializer(settlements, many=True).data)

    def post(self, request, share_code):
        group = _get_group(share_code)
        serializer = SettlementSerializer(data=request.data, context={"group": group})
        serializer.is_valid(raise_exception=True)
        settlement = serializer.save()
        return Response(SettlementSerializer(settlement).data, status=status.HTTP_201_CREATED)


class BalancesView(APIView):
    def get(self, request, share_code):
        group = _get_group(share_code)
        members = list(group.members.all())
        member_by_id = {member.id: member for member in members}

        expenses = list(group.expenses.prefetch_related("shares"))
        expense_inputs = [
            ExpenseInput(
                paid_by=expense.paid_by_id,
                amount_paise=expense.amount_paise,
                shares=[
                    ExpenseShareInput(member_id=share.member_id, share_paise=share.share_paise)
                    for share in expense.shares.all()
                ],
            )
            for expense in expenses
        ]
        settlement_inputs = [
            SettlementInput(
                from_member=settlement.from_member_id,
                to_member=settlement.to_member_id,
                amount_paise=settlement.amount_paise,
            )
            for settlement in group.settlements.all()
        ]

        # Balances and suggested payments are always derived fresh; only
        # completed settlements are ever persisted.
        net_balances = compute_net_balances(expense_inputs, settlement_inputs, member_by_id.keys())
        transfers = simplify_debts(net_balances)

        total_spent_paise = sum(expense.amount_paise for expense in expenses)

        balances_payload = [
            {
                "member_id": member_id,
                "name": member_by_id[member_id].name,
                "balance_paise": balance,
                "balance": _signed_amount(balance),
            }
            for member_id, balance in net_balances.items()
        ]

        suggested_payments = [
            {
                "from_member": transfer.from_member,
                "from_name": member_by_id[transfer.from_member].name,
                "to_member": transfer.to_member,
                "to_name": member_by_id[transfer.to_member].name,
                "to_upi_id": member_by_id[transfer.to_member].upi_id,
                "amount_paise": transfer.amount_paise,
                "amount": paise_to_rupees_str(transfer.amount_paise),
                "upi_link": build_upi_link(
                    upi_id=member_by_id[transfer.to_member].upi_id,
                    payee_name=member_by_id[transfer.to_member].name,
                    amount_paise=transfer.amount_paise,
                    note=f"TripSplit: {group.name}",
                ),
            }
            for transfer in transfers
        ]

        return Response(
            {
                "group": group.name,
                "total_spent": paise_to_rupees_str(total_spent_paise),
                "is_settled": len(transfers) == 0,
                "balances": balances_payload,
                "suggested_payments": suggested_payments,
            }
        )


def _signed_amount(balance_paise: int) -> str:
    sign = "+" if balance_paise > 0 else "-" if balance_paise < 0 else ""
    return f"{sign}{paise_to_rupees_str(abs(balance_paise))}"
