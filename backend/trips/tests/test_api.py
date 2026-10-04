from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from trips.models import Expense, Group, Member


class CreateTripApiTests(APITestCase):
    def test_create_trip_success(self):
        resp = self.client.post(
            reverse("group-list-create"),
            {
                "name": "Munnar Trip",
                "members": [
                    {"name": "Dheeraj", "upi_id": "dheeraj@okaxis"},
                    {"name": "Arjun", "upi_id": "arjun@ybl"},
                    {"name": "Meera", "upi_id": "meera@paytm"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp.data["members"]), 3)
        self.assertEqual(len(resp.data["share_code"]), 8)
        self.assertEqual(Group.objects.count(), 1)
        self.assertEqual(Member.objects.count(), 3)

    def test_create_trip_requires_at_least_two_members(self):
        resp = self.client.post(
            reverse("group-list-create"),
            {"name": "Solo Trip", "members": [{"name": "Al", "upi_id": "al@okaxis"}]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Group.objects.count(), 0)

    def test_create_trip_rejects_duplicate_names_case_insensitive(self):
        resp = self.client.post(
            reverse("group-list-create"),
            {
                "name": "Dup Trip",
                "members": [
                    {"name": "Al", "upi_id": "al@okaxis"},
                    {"name": "al", "upi_id": "bo@okaxis"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Group.objects.count(), 0)

    def test_create_trip_rejects_bad_upi_id(self):
        resp = self.client.post(
            reverse("group-list-create"),
            {
                "name": "Bad UPI Trip",
                "members": [
                    {"name": "Al", "upi_id": "not-a-upi-id"},
                    {"name": "Bo", "upi_id": "bo@okaxis"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Group.objects.count(), 0)


class TripApiTestCase(APITestCase):
    """Base class that creates a 3-member trip for tests that need one."""

    def setUp(self):
        resp = self.client.post(
            reverse("group-list-create"),
            {
                "name": "Munnar Trip",
                "members": [
                    {"name": "Dheeraj", "upi_id": "dheeraj@okaxis"},
                    {"name": "Arjun", "upi_id": "arjun@ybl"},
                    {"name": "Meera", "upi_id": "meera@paytm"},
                ],
            },
            format="json",
        )
        self.share_code = resp.data["share_code"]
        self.members = {member["name"]: member["id"] for member in resp.data["members"]}

    def add_expense(self, **overrides):
        payload = {
            "paid_by": self.members["Dheeraj"],
            "amount": "1500.00",
            "description": "Houseboat",
        }
        payload.update(overrides)
        return self.client.post(
            reverse("expense-list-create", args=[self.share_code]), payload, format="json"
        )

    def get_balances(self):
        return self.client.get(reverse("group-balances", args=[self.share_code]))


class AddExpenseApiTests(TripApiTestCase):
    def test_add_expense_success(self):
        resp = self.add_expense()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["amount_paise"], 150000)
        self.assertEqual(resp.data["amount_display"], "1500.00")
        self.assertEqual(len(resp.data["shares"]), 3)
        self.assertEqual(sum(share["share_paise"] for share in resp.data["shares"]), 150000)

    def test_add_expense_defaults_to_splitting_between_everyone(self):
        resp = self.add_expense(amount="100.00", description="Snacks")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        member_ids_in_shares = {share["member"] for share in resp.data["shares"]}
        self.assertEqual(member_ids_in_shares, set(self.members.values()))

    def test_add_expense_can_split_between_subset(self):
        resp = self.add_expense(
            amount="100.00",
            description="Snacks",
            split_between=[self.members["Dheeraj"], self.members["Arjun"]],
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        member_ids_in_shares = {share["member"] for share in resp.data["shares"]}
        self.assertEqual(member_ids_in_shares, {self.members["Dheeraj"], self.members["Arjun"]})

    def _create_other_trip_member(self):
        resp = self.client.post(
            reverse("group-list-create"),
            {
                "name": "Other Trip",
                "members": [
                    {"name": "Zoya", "upi_id": "zoya@okaxis"},
                    {"name": "Kabir", "upi_id": "kabir@ybl"},
                ],
            },
            format="json",
        )
        return resp.data["members"][0]["id"]

    def test_add_expense_payer_from_another_trip_rejected(self):
        outsider_id = self._create_other_trip_member()
        resp = self.add_expense(paid_by=outsider_id, amount="100.00", description="Snacks")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Expense.objects.count(), 0)

    def test_add_expense_split_member_from_another_trip_rejected(self):
        outsider_id = self._create_other_trip_member()
        resp = self.add_expense(
            amount="100.00",
            description="Snacks",
            split_between=[self.members["Dheeraj"], outsider_id],
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Expense.objects.count(), 0)

    def test_add_expense_rejects_negative_amount(self):
        resp = self.add_expense(amount="-100.00", description="Snacks")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_expense_rejects_three_decimal_amount(self):
        resp = self.add_expense(amount="10.999", description="Snacks")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_expense_rejects_empty_split_between(self):
        resp = self.add_expense(amount="100.00", description="Snacks", split_between=[])
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Expense.objects.count(), 0)


class BalancesApiTests(TripApiTestCase):
    def test_balances_end_to_end_with_upi_links(self):
        self.add_expense()

        resp = self.get_balances()
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total_spent"], "1500.00")
        self.assertFalse(resp.data["is_settled"])
        self.assertEqual(sum(b["balance_paise"] for b in resp.data["balances"]), 0)

        self.assertTrue(resp.data["suggested_payments"])
        for payment in resp.data["suggested_payments"]:
            self.assertTrue(payment["upi_link"].startswith("upi://pay?"))
            self.assertIn("pa=", payment["upi_link"])
            self.assertIn("am=", payment["upi_link"])
            self.assertIn("cu=INR", payment["upi_link"])


class SettlementApiTests(TripApiTestCase):
    def test_mark_as_paid_reduces_debt(self):
        self.add_expense()
        before = next(
            b["balance_paise"] for b in self.get_balances().data["balances"] if b["name"] == "Arjun"
        )

        resp = self.client.post(
            reverse("settlement-list-create", args=[self.share_code]),
            {
                "from_member": self.members["Arjun"],
                "to_member": self.members["Dheeraj"],
                "amount": "500.00",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        after = next(
            b["balance_paise"] for b in self.get_balances().data["balances"] if b["name"] == "Arjun"
        )
        self.assertGreater(after, before)

    def test_fully_settled_trip_reports_is_settled_true(self):
        self.add_expense()

        for payment in self.get_balances().data["suggested_payments"]:
            resp = self.client.post(
                reverse("settlement-list-create", args=[self.share_code]),
                {
                    "from_member": payment["from_member"],
                    "to_member": payment["to_member"],
                    "amount": payment["amount"],
                },
                format="json",
            )
            self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        final = self.get_balances().data
        self.assertTrue(final["is_settled"])
        self.assertEqual(final["suggested_payments"], [])

    def test_settlement_rejects_same_person(self):
        resp = self.client.post(
            reverse("settlement-list-create", args=[self.share_code]),
            {
                "from_member": self.members["Arjun"],
                "to_member": self.members["Arjun"],
                "amount": "100.00",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class DeleteExpenseApiTests(TripApiTestCase):
    def test_delete_expense_updates_balances(self):
        expense_resp = self.add_expense()
        expense_id = expense_resp.data["id"]

        resp = self.client.delete(
            reverse("expense-detail", args=[self.share_code, expense_id])
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Expense.objects.count(), 0)

        balances = self.get_balances().data
        self.assertTrue(balances["is_settled"])
        for balance in balances["balances"]:
            self.assertEqual(balance["balance_paise"], 0)

    def test_unknown_share_code_returns_404(self):
        resp = self.client.get(reverse("group-detail", args=["doesnotexist"]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
