from __future__ import annotations

import json
import sys
from pathlib import Path


OPENMONTAGE_ROOT = Path(__file__).resolve().parents[3] / "tools" / "OpenMontage"
sys.path.insert(0, str(OPENMONTAGE_ROOT))

from lib.config_model import BudgetMode  # noqa: E402
from tools.cost_tracker import BudgetExceededError, CostTracker  # noqa: E402


def main() -> int:
    tracker = CostTracker(
        budget_total_usd=0.0,
        reserve_pct=0.0,
        single_action_approval_usd=999.0,
        require_approval_for_new_paid_tool=False,
        mode=BudgetMode.CAP,
    )

    free_entry = tracker.estimate("local_ffmpeg_double", "inspect", 0.0)
    tracker.reserve(free_entry)
    free_reservation_allowed = tracker.entries[-1]["status"] == "reserved"

    paid_entry = tracker.estimate("external_provider_double", "generate", 0.01)
    positive_spend_blocked = False
    error_type = None
    error_message = None
    try:
        tracker.reserve(paid_entry)
    except BudgetExceededError as exc:
        positive_spend_blocked = True
        error_type = type(exc).__name__
        error_message = str(exc)

    result = {
        "budget_mode": tracker.mode.value,
        "budget_total_usd": tracker.budget_total_usd,
        "free_reservation_allowed": free_reservation_allowed,
        "positive_spend_blocked": positive_spend_blocked,
        "double_only_no_provider_called": True,
        "error_type": error_type,
        "error_message": error_message,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if free_reservation_allowed and positive_spend_blocked else 1


if __name__ == "__main__":
    raise SystemExit(main())
