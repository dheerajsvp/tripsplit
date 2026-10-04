from django.contrib import admin

from .models import Expense, ExpenseShare, Group, Member, Settlement


class MemberInline(admin.TabularInline):
    model = Member
    extra = 0


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ["name", "share_code", "created_at"]
    readonly_fields = ["share_code", "created_at"]
    inlines = [MemberInline]


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ["name", "group", "upi_id"]
    list_filter = ["group"]


class ExpenseShareInline(admin.TabularInline):
    model = ExpenseShare
    extra = 0


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ["description", "group", "paid_by", "amount_paise", "created_at"]
    list_filter = ["group"]
    inlines = [ExpenseShareInline]


@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ["group", "from_member", "to_member", "amount_paise", "paid_at"]
    list_filter = ["group"]
