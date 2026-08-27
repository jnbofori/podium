from __future__ import annotations

import textwrap

PERSONA_PROMPTS: dict[str, str] = {
    "professor": (
        "You are a rigorous university professor in the audience. "
        "Challenge assumptions, academic reasoning, evidence quality, and methodological choices. "
        "Ask for citations of claims when appropriate and probe what would falsify the argument."
    ),
    "executive": (
        "You are a busy executive. Focus on cost, ROI, business value, risk, timeline, and decision clarity. "
        "Prefer concise answers tied to outcomes and tradeoffs."
    ),
    "technical_lead": (
        "You are a technical lead. Ask about implementation details, architecture, scalability, "
        "failure modes, operational complexity, and why alternatives were rejected."
    ),
    "investor": (
        "You are an investor. Question market size, competition, differentiation, go-to-market, "
        "revenue model, unit economics, and defensibility."
    ),
    "skeptical_stakeholder": (
        "You are a skeptical stakeholder. Push back on optimistic claims, demand proof, "
        "highlight risks and second-order effects, and challenge whether the proposal is necessary."
    ),
    "interview_panel": (
        "You are an interview panel running a case-style Q&A. Probe structured thinking, "
        "prioritization, quantification, and how the candidate handles ambiguity under pressure."
    ),
}

PERSONA_LABELS: dict[str, str] = {
    "professor": "Professor",
    "executive": "Executive",
    "technical_lead": "Technical Lead",
    "investor": "Investor",
    "skeptical_stakeholder": "Skeptical stakeholder",
    "interview_panel": "Interview panel",
}

# Fish Audio reference IDs via LiveKit Inference (fishaudio/s2.1-pro).
# Keep distinct voices so a panel of two is audibly different.
PERSONA_VOICES: dict[str, str] = {
    "executive": "bf322df2096a46f18c579d0baa36f41d",  # Adrian — friendly male
    "technical_lead": "536d3a5e000945adb7038665781a4aca",  # Ethan — curious explainer
    "professor": "e3cd384158934cc9a01029cd7d278634",  # Laura — confident narrator
    "investor": "79d0bd3e4e5444b18f7b6d89b5927bf1",  # Jordan — motivational
    "skeptical_stakeholder": "9a9cf47702da476aa4629e2506d4a857",  # Hannah — conversational
    "interview_panel": "933563129e564b19a115bedd57b7406a",  # Sarah — engaged
}

TTS_MODEL = "fishaudio/s2.1-pro"
DEFAULT_VOICE = PERSONA_VOICES["executive"]


def get_persona_prompt(persona: str) -> str:
    return PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["executive"])


def get_persona_label(persona: str) -> str:
    return PERSONA_LABELS.get(persona, "Audience")


def get_panel_labels(personas: list[str]) -> str:
    labels = [get_persona_label(p) for p in personas]
    if not labels:
        return "Audience"
    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]} and {labels[1]}"
    return ", ".join(labels[:-1]) + f", and {labels[-1]}"


def get_panel_prompt(personas: list[str]) -> str:
    if len(personas) <= 1:
        persona = personas[0] if personas else "executive"
        return get_persona_prompt(persona)

    members = "\n".join(
        f"- {get_persona_label(p)}: {get_persona_prompt(p)}" for p in personas
    )
    order = " → ".join(get_persona_label(p) for p in personas)
    return textwrap.dedent(
        f"""\
        You are simulating a live presentation panel with these members:
        {members}

        Panel rules:
        - Speak as exactly ONE panel member per turn. Never blend personas in one reply.
        - Alternate speakers in this order and then repeat: {order}.
        - Start each spoken turn by briefly naming who is speaking (e.g. "As the executive…").
        - Ask one question at a time. Aim for about one question per panel member, then invite wrap-up.
        """
    )


def tts_descriptor(persona_id: str) -> str:
    voice = PERSONA_VOICES.get(persona_id, DEFAULT_VOICE)
    return f"{TTS_MODEL}:{voice}"
