"""UPI id validation, rupee/paise conversion, and UPI deep-link building.
No Django imports here — stays unit-testable in isolation.
"""

import re
from decimal import Decimal, InvalidOperation
from urllib.parse import quote, urlencode

UPI_ID_PATTERN = re.compile(r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$")

NOTE_MAX_LENGTH = 50


def is_valid_upi_id(upi_id: str) -> bool:
    return bool(UPI_ID_PATTERN.match(upi_id))


def paise_to_rupees_str(amount_paise: int) -> str:
    """45050 -> "450.50". Integer math only, no float rounding."""
    rupees, paise = divmod(amount_paise, 100)
    return f"{rupees}.{paise:02d}"


def rupees_to_paise(rupees_str: str) -> int:
    """"450.50" -> 45050. Rejects non-numbers and more than 2 decimal places."""
    try:
        rupees = Decimal(rupees_str)
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"Not a valid rupee amount: {rupees_str!r}")

    exponent = rupees.as_tuple().exponent
    if not isinstance(exponent, int) or exponent < -2:
        raise ValueError(f"Amount has more than 2 decimal places: {rupees_str!r}")

    return int(rupees * 100)


def build_upi_link(upi_id: str, payee_name: str, amount_paise: int, note: str) -> str:
    """upi://pay?pa=...&pn=...&am=...&cu=INR&tn=... with spaces as %20."""
    params = {
        "pa": upi_id,
        "pn": payee_name,
        "am": paise_to_rupees_str(amount_paise),
        "cu": "INR",
        "tn": note[:NOTE_MAX_LENGTH],
    }
    query = urlencode(params, quote_via=quote, safe="@")
    return f"upi://pay?{query}"
