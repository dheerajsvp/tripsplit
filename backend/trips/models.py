import secrets
import string

from django.db import models

SHARE_CODE_ALPHABET = string.ascii_letters + string.digits + "-_"
SHARE_CODE_LENGTH = 8


def generate_share_code() -> str:
    return "".join(secrets.choice(SHARE_CODE_ALPHABET) for _ in range(SHARE_CODE_LENGTH))


class Group(models.Model):
    name = models.CharField(max_length=200)
    share_code = models.CharField(
        max_length=SHARE_CODE_LENGTH,
        unique=True,
        default=generate_share_code,
        editable=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Member(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="members")
    name = models.CharField(max_length=100)
    upi_id = models.CharField(max_length=321)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["group", "name"], name="unique_member_name_per_group"),
        ]

    def __str__(self):
        return f"{self.name} ({self.group.name})"


class Expense(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="expenses")
    # PROTECT: a member who paid for something can't be deleted without
    # breaking the books for everyone else in the trip.
    paid_by = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="expenses_paid")
    amount_paise = models.PositiveBigIntegerField()
    description = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(check=models.Q(amount_paise__gt=0), name="expense_amount_positive"),
        ]

    def __str__(self):
        return f"{self.description} ({self.amount_paise}p)"


class ExpenseShare(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="shares")
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="expense_shares")
    share_paise = models.PositiveBigIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["expense", "member"], name="unique_member_per_expense"),
        ]

    def __str__(self):
        return f"{self.member.name}: {self.share_paise}p of {self.expense_id}"


class Settlement(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="settlements")
    from_member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="settlements_paid")
    to_member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="settlements_received")
    amount_paise = models.PositiveBigIntegerField()
    paid_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(amount_paise__gt=0), name="settlement_amount_positive"),
            models.CheckConstraint(
                check=~models.Q(from_member=models.F("to_member")),
                name="settlement_from_ne_to",
            ),
        ]

    def __str__(self):
        return f"{self.from_member.name} -> {self.to_member.name}: {self.amount_paise}p"
