import pytest

from app.services.evaluate import average_score
from app.services.pptx import parse_pptx


def test_average_score_with_score_objects():
    assert (
        average_score(
            {
                "scores": {
                    "clarity": {"value": 8, "rationale": "clear"},
                    "pacing": {"value": 6, "rationale": "ok"},
                }
            }
        )
        == 7.0
    )


def test_average_score_accepts_legacy_numbers():
    assert average_score({"scores": {"clarity": 8, "pacing": 6}}) == 7.0


def test_parse_pptx_rejects_non_pptx():
    with pytest.raises(ValueError, match="pptx"):
        parse_pptx(b"not a zip", "notes.txt")
