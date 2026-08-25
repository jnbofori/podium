from __future__ import annotations

import io
import re
import zipfile
from xml.etree import ElementTree

from app.config import get_settings

A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


def _extract_text_from_slide_xml(xml: str) -> str:
    try:
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError:
        texts = re.findall(r"<a:t[^>]*>([\s\S]*?)</a:t>", xml)
        return " ".join(t.strip() for t in texts if t.strip())

    parts: list[str] = []
    for node in root.iter(f"{A_NS}t"):
        if node.text and node.text.strip():
            parts.append(node.text.strip())
    return " ".join(parts)


def _slide_sort_key(path: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", path, re.IGNORECASE)
    return int(match.group(1)) if match else 10**9


def parse_pptx(data: bytes, file_name: str) -> dict:
    settings = get_settings()
    if not file_name.lower().endswith(".pptx"):
        raise ValueError("Only .pptx files are supported")
    if len(data) > settings.max_upload_bytes:
        raise ValueError("File must be under 20MB")

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        slide_files = sorted(
            [
                name
                for name in zf.namelist()
                if re.match(r"ppt/slides/slide\d+\.xml$", name, re.IGNORECASE)
            ],
            key=_slide_sort_key,
        )
        if not slide_files:
            raise ValueError("No slides found in this PowerPoint")

        slides: list[dict] = []
        for index, path in enumerate(slide_files, start=1):
            xml = zf.read(path).decode("utf-8", errors="ignore")
            text = _extract_text_from_slide_xml(xml)
            slides.append(
                {
                    "index": index,
                    "text": text or "(No extractable text on this slide)",
                }
            )

    plain = "\n\n".join(f"Slide {s['index']}:\n{s['text']}" for s in slides)
    if len(plain) > settings.deck_text_limit:
        plain = (
            plain[: settings.deck_text_limit]
            + "\n\n[Deck truncated for session context]"
        )

    return {
        "slides": slides,
        "plainText": plain,
        "slideCount": len(slides),
        "fileName": file_name,
    }
