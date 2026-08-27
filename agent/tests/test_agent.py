import textwrap

import pytest
from livekit.agents import AgentSession, inference, llm

from agent import AudienceInterviewer, SessionState, _parse_metadata, _ready_for_questions
from personas import get_panel_labels, get_panel_prompt, tts_descriptor


def _judge_llm() -> llm.LLM:
    return inference.LLM(model="openai/gpt-4.1-mini")


def _sample_state() -> SessionState:
    return SessionState(
        personas=["executive", "technical_lead"],
        deck_plain_text="Slide 1: We propose migrating reporting to PostgreSQL for reliability.",
        slide_count=1,
        file_name="demo.pptx",
    )


def test_ready_for_questions_phrases() -> None:
    assert _ready_for_questions("I'm done presenting")
    assert _ready_for_questions("Ready for questions now")
    assert not _ready_for_questions("Next I will cover the architecture")


def test_parse_metadata_personas_array() -> None:
    state = _parse_metadata(
        '{"personas":["executive","technical_lead"],"slideCount":2}'
    )
    assert state.personas == ["executive", "technical_lead"]
    assert state.persona == "executive"
    assert state.slide_count == 2


def test_parse_metadata_legacy_persona() -> None:
    state = _parse_metadata('{"persona":"investor"}')
    assert state.personas == ["investor"]


def test_panel_helpers() -> None:
    assert "Executive and Technical Lead" == get_panel_labels(
        ["executive", "technical_lead"]
    )
    prompt = get_panel_prompt(["executive", "technical_lead"])
    assert "Executive" in prompt
    assert "Technical Lead" in prompt
    assert tts_descriptor("executive").startswith("fishaudio/s2.1-pro:")


@pytest.mark.asyncio
async def test_interviewer_asks_a_question() -> None:
    """Audience interviewer should ask a persona-grounded question."""
    state = _sample_state()
    async with (
        _judge_llm() as judge_llm,
        AgentSession() as session,
    ):
        await session.start(AudienceInterviewer(state))

        result = await session.run(
            user_input="I finished presenting. We chose PostgreSQL for reliability and cost."
        )

        await (
            result.expect.next_event()
            .is_message(role="assistant")
            .judge(
                judge_llm,
                intent=textwrap.dedent(
                    """\
                    Asks a follow-up question as an audience panel member
                    (executive-style business focus or technical-lead architecture focus).
                    The question should relate to the database choice, cost, ROI, risk,
                    or implementation.
                    """
                ),
            )
        )
