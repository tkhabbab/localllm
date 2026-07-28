import logging
from paddleocr import PaddleOCR

logger = logging.getLogger(__name__)

_ocr_instance = None


def get_ocr() -> PaddleOCR:
    global _ocr_instance
    if _ocr_instance is None:
        _ocr_instance = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _ocr_instance


def extract_text_from_image(image_path: str) -> str:
    ocr = get_ocr()
    result = ocr.ocr(image_path, cls=True)
    lines = []
    if result:
        for page in result:
            if page:
                for line in page:
                    if line and len(line) >= 2:
                        text = line[1][0] if isinstance(line[1], (list, tuple)) else str(line[1])
                        lines.append(text)
    return "\n".join(lines)


def extract_text_from_pdf_ocr(pdf_path: str) -> tuple[str, int]:
    ocr = get_ocr()
    result = ocr.ocr(pdf_path, cls=True)
    pages_text = []
    page_count = 0
    if result:
        for page_idx, page in enumerate(result):
            page_count += 1
            page_lines = []
            if page:
                for line in page:
                    if line and len(line) >= 2:
                        text = line[1][0] if isinstance(line[1], (list, tuple)) else str(line[1])
                        page_lines.append(text)
            pages_text.append(f"[Page {page_idx + 1}]\n" + "\n".join(page_lines))
    return "\n\n".join(pages_text), page_count
