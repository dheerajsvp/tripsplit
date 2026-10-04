import random
import unittest

from trips.services.balances import (
    ExpenseInput,
    ExpenseShareInput,
    SettlementInput,
    compute_net_balances,
    simplify_debts,
    split_equally,
)


class SplitEquallyTests(unittest.TestCase):
    def test_divisible_amount(self):
        self.assertEqual(split_equally(9000, [1, 2, 3]), {1: 3000, 2: 3000, 3: 3000})

    def test_leftover_paise_go_to_lowest_ids(self):
        # ₹100 split 3 ways -> 3334, 3333, 3333 paise.
        self.assertEqual(split_equally(10000, [1, 2, 3]), {1: 3334, 2: 3333, 3: 3333})

    def test_shares_always_sum_to_total(self):
        for total, member_ids in [(10000, [1, 2, 3]), (101, [5, 6, 7, 8]), (1, [9])]:
            shares = split_equally(total, member_ids)
            self.assertEqual(sum(shares.values()), total)

    def test_deterministic_regardless_of_input_order(self):
        self.assertEqual(
            split_equally(10000, [3, 1, 2]),
            split_equally(10000, [1, 2, 3]),
        )

    def test_raises_on_zero_members(self):
        with self.assertRaises(ValueError):
            split_equally(10000, [])

    def test_raises_on_non_positive_amount(self):
        with self.assertRaises(ValueError):
            split_equally(0, [1, 2])
        with self.assertRaises(ValueError):
            split_equally(-100, [1, 2])


class ComputeNetBalancesTests(unittest.TestCase):
    def test_simple_three_person_case(self):
        expenses = [
            ExpenseInput(
                paid_by=1,
                amount_paise=9000,
                shares=[
                    ExpenseShareInput(1, 3000),
                    ExpenseShareInput(2, 3000),
                    ExpenseShareInput(3, 3000),
                ],
            )
        ]
        balances = compute_net_balances(expenses, [], [1, 2, 3])
        self.assertEqual(balances, {1: 6000, 2: -3000, 3: -3000})
        self.assertEqual(sum(balances.values()), 0)

    def test_one_person_paid_everything(self):
        expenses = [
            ExpenseInput(
                paid_by=1,
                amount_paise=10000,
                shares=[ExpenseShareInput(1, 5000), ExpenseShareInput(2, 5000)],
            )
        ]
        balances = compute_net_balances(expenses, [], [1, 2])
        self.assertEqual(balances, {1: 5000, 2: -5000})

    def test_partial_split_subset_of_members(self):
        # 3-member trip, but this expense only involves 1 and 2.
        expenses = [
            ExpenseInput(
                paid_by=1,
                amount_paise=2000,
                shares=[ExpenseShareInput(1, 1000), ExpenseShareInput(2, 1000)],
            )
        ]
        balances = compute_net_balances(expenses, [], [1, 2, 3])
        self.assertEqual(balances, {1: 1000, 2: -1000, 3: 0})

    def test_settlements_move_balances_toward_zero(self):
        expenses = [
            ExpenseInput(
                paid_by=1,
                amount_paise=10000,
                shares=[ExpenseShareInput(1, 5000), ExpenseShareInput(2, 5000)],
            )
        ]
        settlements = [SettlementInput(from_member=2, to_member=1, amount_paise=5000)]
        balances = compute_net_balances(expenses, settlements, [1, 2])
        self.assertEqual(balances, {1: 0, 2: 0})

    def test_balances_always_sum_to_zero(self):
        expenses = [
            ExpenseInput(
                paid_by=1,
                amount_paise=10000,
                shares=[
                    ExpenseShareInput(1, 3334),
                    ExpenseShareInput(2, 3333),
                    ExpenseShareInput(3, 3333),
                ],
            )
        ]
        settlements = [SettlementInput(from_member=3, to_member=1, amount_paise=1000)]
        balances = compute_net_balances(expenses, settlements, [1, 2, 3])
        self.assertEqual(sum(balances.values()), 0)

    def test_member_with_no_activity_shows_zero(self):
        balances = compute_net_balances([], [], [1, 2, 3])
        self.assertEqual(balances, {1: 0, 2: 0, 3: 0})

    def test_raises_when_shares_dont_sum_to_amount(self):
        expenses = [
            ExpenseInput(
                paid_by=1,
                amount_paise=10000,
                shares=[ExpenseShareInput(1, 4000), ExpenseShareInput(2, 4000)],
            )
        ]
        with self.assertRaises(ValueError):
            compute_net_balances(expenses, [], [1, 2])


class SimplifyDebtsTests(unittest.TestCase):
    def test_already_settled_gives_no_transfers(self):
        self.assertEqual(simplify_debts({1: 0, 2: 0, 3: 0}), [])

    def test_two_people_gives_one_transfer(self):
        transfers = simplify_debts({1: 5000, 2: -5000})
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0].from_member, 2)
        self.assertEqual(transfers[0].to_member, 1)
        self.assertEqual(transfers[0].amount_paise, 5000)

    def test_five_people_at_most_n_minus_one_transfers(self):
        balances = {1: 10000, 2: 5000, 3: -3000, 4: -4000, 5: -8000}
        transfers = simplify_debts(balances)
        self.assertLessEqual(len(transfers), len(balances) - 1)

    def test_applying_transfers_zeroes_every_balance(self):
        balances = {1: 10000, 2: 5000, 3: -3000, 4: -4000, 5: -8000}
        transfers = simplify_debts(balances)
        result = dict(balances)
        for transfer in transfers:
            result[transfer.from_member] += transfer.amount_paise
            result[transfer.to_member] -= transfer.amount_paise
        for balance in result.values():
            self.assertEqual(balance, 0)

    def test_raises_when_balances_dont_sum_to_zero(self):
        with self.assertRaises(ValueError):
            simplify_debts({1: 100, 2: -50})


class SimplifyDebtsRandomizedTests(unittest.TestCase):
    def _random_balances(self, num_members, rng):
        amounts = [rng.randint(-100_000, 100_000) for _ in range(num_members - 1)]
        amounts.append(-sum(amounts))
        rng.shuffle(amounts)
        return {member_id: amount for member_id, amount in enumerate(amounts, start=1)}

    def test_two_hundred_random_trips(self):
        rng = random.Random(12345)
        for _ in range(200):
            num_members = rng.randint(2, 10)
            balances = self._random_balances(num_members, rng)

            self.assertEqual(sum(balances.values()), 0)

            transfers = simplify_debts(balances)

            non_zero_members = {member_id for member_id, b in balances.items() if b != 0}
            self.assertLessEqual(len(transfers), max(len(non_zero_members) - 1, 0))

            result = dict(balances)
            for transfer in transfers:
                result[transfer.from_member] += transfer.amount_paise
                result[transfer.to_member] -= transfer.amount_paise
            for balance in result.values():
                self.assertEqual(balance, 0)


if __name__ == "__main__":
    unittest.main()
