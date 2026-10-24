from django.db import transaction

from .models import Expense, ExpenseShare, Group, Member, Settlement
from .services.balances import split_equally
from .services.upi import rupees_to_paise

DEMO_TRIP_NAME = "Goa Trip (Demo)"

# Obviously fake UPI IDs: visitors never need to enter anything real.
DEMO_MEMBERS = [
    ("Asha", "asha.demo@upi"),
    ("Rahul", "rahul.demo@upi"),
    ("Meera", "meera.demo@upi"),
    ("Kabir", "kabir.demo@upi"),
]

# (description, amount in rupees, payer, split between; None = everyone)
DEMO_EXPENSES = [
    ("Beach shack dinner", "2450.00", "Asha", None),
    ("Scooter rentals", "1800.00", "Rahul", None),
    ("Cab from airport", "1250.50", "Meera", None),
    ("Villa stay", "9600.00", "Kabir", None),
    ("Sunset cruise", "2100.00", "Asha", ["Asha", "Meera", "Kabir"]),
    ("Late-night snacks", "333.00", "Rahul", ["Rahul", "Kabir"]),
]

# (from, to, amount in rupees)
DEMO_SETTLEMENTS = [
    ("Rahul", "Asha", "500.00"),
]


def create_demo_group() -> Group:
    """Create a fresh, fully populated demo trip with its own share code."""
    with transaction.atomic():
        group = Group.objects.create(name=DEMO_TRIP_NAME)
        members = {
            name: Member.objects.create(group=group, name=name, upi_id=upi_id)
            for name, upi_id in DEMO_MEMBERS
        }

        for description, amount, payer, split_names in DEMO_EXPENSES:
            amount_paise = rupees_to_paise(amount)
            split_members = (
                [members[name] for name in split_names]
                if split_names is not None
                else list(members.values())
            )
            expense = Expense.objects.create(
                group=group,
                paid_by=members[payer],
                amount_paise=amount_paise,
                description=description,
            )
            shares = split_equally(amount_paise, [member.id for member in split_members])
            ExpenseShare.objects.bulk_create(
                ExpenseShare(expense=expense, member_id=member_id, share_paise=share_paise)
                for member_id, share_paise in shares.items()
            )

        for from_name, to_name, amount in DEMO_SETTLEMENTS:
            Settlement.objects.create(
                group=group,
                from_member=members[from_name],
                to_member=members[to_name],
                amount_paise=rupees_to_paise(amount),
            )
    return group
