from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path


class SlideRenderError(Exception):
    """Raised when PPTX cannot be converted to slide PNGs."""


def _find_soffice() -> str:
    candidates = [
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
        "/usr/lib/libreoffice/program/soffice",
    ]
    for path in candidates:
        if path and Path(path).is_file():
            return path
    raise SlideRenderError(
        "LibreOffice (soffice) is required to render slides. "
        "Install LibreOffice and ensure soffice is on PATH."
    )


def render_pptx_to_pngs(data: bytes, file_name: str = "deck.pptx") -> list[bytes]:
    """Convert a PPTX to ordered PNG page bytes via LibreOffice + PyMuPDF."""
    import fitz  # pymupdf

    soffice = _find_soffice()
    safe_name = Path(file_name).name
    if not safe_name.lower().endswith(".pptx"):
        safe_name = f"{safe_name}.pptx"

    with tempfile.TemporaryDirectory(prefix="podium-slides-") as tmp:
        tmp_path = Path(tmp)
        pptx_path = tmp_path / safe_name
        pptx_path.write_bytes(data)

        try:
            result = subprocess.run(
                [
                    soffice,
                    "--headless",
                    "--nologo",
                    "--nofirststartwizard",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(tmp_path),
                    str(pptx_path),
                ],
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise SlideRenderError("Slide conversion timed out") from exc
        except FileNotFoundError as exc:
            raise SlideRenderError(
                "LibreOffice (soffice) is required to render slides"
            ) from exc

        pdf_path = pptx_path.with_suffix(".pdf")
        if not pdf_path.is_file():
            detail = (result.stderr or result.stdout or "").strip()
            raise SlideRenderError(
                "LibreOffice failed to produce a PDF"
                + (f": {detail}" if detail else "")
            )

        doc = fitz.open(pdf_path)
        try:
            if doc.page_count < 1:
                raise SlideRenderError("Converted PDF has no pages")
            pngs: list[bytes] = []
            # ~150 DPI equivalent for readable slides without huge files
            matrix = fitz.Matrix(150 / 72, 150 / 72)
            for page in doc:
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                pngs.append(pix.tobytes("png"))
            return pngs
        finally:
            doc.close()
