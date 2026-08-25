import pytest

from app.services.evaluate import average_score, build_heuristic_report
from app.services.pptx import parse_pptx


def test_build_heuristic_report_basic():
    report = build_heuristic_report(
        persona="executive",
        transcript=[
            {
                "role": "user",
                "content": "Um today we chose Postgres like for reliability",
                "timestampSec": 0,
            },
            {"role": "assistant", "content": "Why?", "timestampSec": 30},
            {"role": "user", "content": "Cost.", "timestampSec": 40},
        ],
        phase_boundary_sec=30,
    )
    assert "scores" in report
    assert average_score(report) is not None


def test_parse_pptx_rejects_non_pptx():
    with pytest.raises(ValueError, match="pptx"):
        parse_pptx(b"not a zip", "notes.txt")
