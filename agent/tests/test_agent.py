import textwrap

import pytest
from livekit.agents import AgentSession, inference, llm

from agent import AudienceInterviewer, SessionState, _ready_for_questions


def _judge_llm() -> llm.LLM:
    return inference.LLM(model="openai/gpt-4.1-mini")


def _sample_state() -> SessionState:
    return SessionState(
        persona="executive",
        deck_plain_text="Slide 1: We propose migrating reporting to PostgreSQL for reliability.",
        slide_count=1,
        file_name="demo.pptx",
    )


def test_ready_for_questions_phrases() -> None:
    assert _ready_for_questions("I'm done presenting")
    assert _ready_for_questions("Ready for questions now")
    assert not _ready_for_questions("Next I will cover the architecture")


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
                    Asks a follow-up question as an executive-style audience member.
                    The question should relate to business value, cost, ROI, risk, or the database choice.
                    """
                ),
            )
        )
