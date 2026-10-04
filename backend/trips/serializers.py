from django.db import transaction
from rest_framework import serializers

from .models import Expense, ExpenseShare, Group, Member, Settlement
from .services.balances import split_equally
from .services.upi import is_valid_upi_id, paise_to_rupees_str, rupees_to_paise

MIN_AMOUNT_PAISE = 1
MAX_AMOUNT_PAISE = 100_000_000  # ₹10,00,000


def _parse_amount(value: str) -> int:
    try:
        return rupees_to_paise(value)
    except ValueError as exc:
        raise serializers.ValidationError(str(exc))


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "name", "upi_id"]

    def validate_upi_id(self, value):
        if not is_valid_upi_id(value):
            raise serializers.ValidationError("Not a valid UPI ID.")
        return value

    def validate_name(self, value):
        group = self.context.get("group")
        if group is not None and Member.objects.filter(group=group, name__iexact=value).exists():
            raise serializers.ValidationError("A member with this name already exists in this trip.")
        return value


class GroupSerializer(serializers.ModelSerializer):
    members = MemberSerializer(many=True)

    class Meta:
        model = Group
        fields = ["id", "name", "share_code", "created_at", "members"]
        read_only_fields = ["id", "share_code", "created_at"]

    def validate_members(self, members):
        if len(members) < 2:
            raise serializers.ValidationError("A trip needs at least 2 members.")
        names_lower = [member["name"].lower() for member in members]
        if len(names_lower) != len(set(names_lower)):
            raise serializers.ValidationError("Member names must be unique within a trip.")
        return members

    def create(self, validated_data):
        members_data = validated_data.pop("members")
        with transaction.atomic():
            group = Group.objects.create(**validated_data)
            Member.objects.bulk_create(
                Member(group=group, **member_data) for member_data in members_data
            )
        return group


class ExpenseShareSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.name", read_only=True)
    share = serializers.SerializerMethodField()

    class Meta:
        model = ExpenseShare
        fields = ["member", "member_name", "share_paise", "share"]

    def get_share(self, obj):
        return paise_to_rupees_str(obj.share_paise)


class ExpenseSerializer(serializers.ModelSerializer):
    paid_by_name = serializers.CharField(source="paid_by.name", read_only=True)
    amount = serializers.CharField(write_only=True, source="amount_paise")
    amount_display = serializers.SerializerMethodField()
    split_between = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    shares = ExpenseShareSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "paid_by",
            "paid_by_name",
            "amount",
            "amount_paise",
            "amount_display",
            "description",
            "split_between",
            "shares",
            "created_at",
        ]
        read_only_fields = ["id", "amount_paise", "created_at"]

    def get_amount_display(self, obj):
        return paise_to_rupees_str(obj.amount_paise)

    def validate_amount(self, value):
        paise = _parse_amount(value)
        if not (MIN_AMOUNT_PAISE <= paise <= MAX_AMOUNT_PAISE):
            raise serializers.ValidationError("Amount must be between ₹0.01 and ₹10,00,000.")
        return paise

    def validate(self, attrs):
        group = self.context["group"]

        paid_by = attrs.get("paid_by")
        if paid_by.group_id != group.id:
            raise serializers.ValidationError({"paid_by": "Payer must belong to this trip."})

        split_between_ids = attrs.pop("split_between", None)
        if split_between_ids is not None:
            members = list(Member.objects.filter(group=group, id__in=split_between_ids))
            if len(members) != len(set(split_between_ids)):
                raise serializers.ValidationError(
                    {"split_between": "All split members must belong to this trip."}
                )
        else:
            members = list(group.members.all())

        if not members:
            raise serializers.ValidationError(
                {"split_between": "At least one member is required to split an expense between."}
            )

        attrs["split_members"] = members
        return attrs

    def create(self, validated_data):
        group = self.context["group"]
        split_members = validated_data.pop("split_members")
        amount_paise = validated_data.pop("amount_paise")
        paid_by = validated_data.pop("paid_by")
        description = validated_data.pop("description")

        shares = split_equally(amount_paise, [member.id for member in split_members])

        with transaction.atomic():
            expense = Expense.objects.create(
                group=group,
                paid_by=paid_by,
                amount_paise=amount_paise,
                description=description,
            )
            ExpenseShare.objects.bulk_create(
                ExpenseShare(expense=expense, member_id=member_id, share_paise=share_paise)
                for member_id, share_paise in shares.items()
            )
        return expense


class SettlementSerializer(serializers.ModelSerializer):
    from_member_name = serializers.CharField(source="from_member.name", read_only=True)
    to_member_name = serializers.CharField(source="to_member.name", read_only=True)
    amount = serializers.CharField(write_only=True, source="amount_paise")
    amount_display = serializers.SerializerMethodField()

    class Meta:
        model = Settlement
        fields = [
            "id",
            "from_member",
            "from_member_name",
            "to_member",
            "to_member_name",
            "amount",
            "amount_paise",
            "amount_display",
            "paid_at",
        ]
        read_only_fields = ["id", "amount_paise", "paid_at"]

    def get_amount_display(self, obj):
        return paise_to_rupees_str(obj.amount_paise)

    def validate_amount(self, value):
        paise = _parse_amount(value)
        if paise <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return paise

    def validate(self, attrs):
        group = self.context["group"]
        from_member = attrs["from_member"]
        to_member = attrs["to_member"]

        if from_member.id == to_member.id:
            raise serializers.ValidationError("from_member and to_member must be different.")
        if from_member.group_id != group.id or to_member.group_id != group.id:
            raise serializers.ValidationError("Both members must belong to this trip.")

        return attrs

    def create(self, validated_data):
        return Settlement.objects.create(group=self.context["group"], **validated_data)
