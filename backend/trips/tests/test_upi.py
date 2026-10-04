import unittest

from trips.services.upi import (
    build_upi_link,
    is_valid_upi_id,
    paise_to_rupees_str,
    rupees_to_paise,
)


class IsValidUpiIdTests(unittest.TestCase):
    def test_valid_ids(self):
        for upi_id in ["dheeraj@okaxis", "arjun.k_9@ybl", "meera-1@paytm"]:
            self.assertTrue(is_valid_upi_id(upi_id), upi_id)

    def test_invalid_ids(self):
        for upi_id in ["no-at-sign", "@okaxis", "a@o", "a b@okaxis", "a@1xis", ""]:
            self.assertFalse(is_valid_upi_id(upi_id), upi_id)


class PaiseToRupeesStrTests(unittest.TestCase):
    def test_small_amount(self):
        self.assertEqual(paise_to_rupees_str(5), "0.05")

    def test_larger_amount(self):
        self.assertEqual(paise_to_rupees_str(45050), "450.50")

    def test_zero(self):
        self.assertEqual(paise_to_rupees_str(0), "0.00")


class RupeesToPaiseTests(unittest.TestCase):
    def test_round_trip(self):
        self.assertEqual(rupees_to_paise("450.50"), 45050)
        self.assertEqual(rupees_to_paise("0.05"), 5)

    def test_rejects_more_than_two_decimal_places(self):
        with self.assertRaises(ValueError):
            rupees_to_paise("10.999")

    def test_rejects_non_numbers(self):
        with self.assertRaises(ValueError):
            rupees_to_paise("not-a-number")
        with self.assertRaises(ValueError):
            rupees_to_paise("")


class BuildUpiLinkTests(unittest.TestCase):
    def test_link_contains_correct_fields(self):
        link = build_upi_link("dheeraj@okaxis", "Dheeraj", 50000, "TripSplit: Munnar Trip")
        self.assertIn("pa=dheeraj@okaxis", link)
        self.assertIn("am=500.00", link)
        self.assertIn("cu=INR", link)
        self.assertTrue(link.startswith("upi://pay?"))

    def test_spaces_are_encoded_as_percent_20(self):
        link = build_upi_link("dheeraj@okaxis", "Dheeraj", 50000, "TripSplit: Munnar Trip")
        self.assertIn("%20", link)
        self.assertNotIn("+", link)

    def test_note_truncated_to_fifty_chars(self):
        long_note = "x" * 100
        link = build_upi_link("dheeraj@okaxis", "Dheeraj", 100, long_note)
        self.assertIn("tn=" + "x" * 50, link)
        self.assertNotIn("x" * 51, link)


if __name__ == "__main__":
    unittest.main()
