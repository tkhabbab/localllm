import base64
import logging
import fitz  # PyMuPDF
from app.config import get_settings
from app.services.ollama_client import ollama_client

logger = logging.getLogger(__name__)

VISION_PROMPT = "Extract all text and data from this document/image exactly as written. Preserve the structure, tables, and language (e.g. Bengali or English). Do not add any conversational filler or descriptions like 'The image shows...'. Only output the extracted text."

def encode_image(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode('utf-8')

async def extract_text_from_image_vision(image_path: str) -> str:
    try:
        with open(image_path, "rb") as image_file:
            b64_image = encode_image(image_file.read())
        
        settings = get_settings()
        messages = [
            {
                "role": "user",
                "content": VISION_PROMPT,
                "images": [b64_image]
            }
        ]
        
        extracted_text = await ollama_client.chat(
            model=settings.MODEL_VISION,
            messages=messages,
            temperature=0.1
        )
        return extracted_text.strip()
    except Exception as e:
        logger.error(f"Vision extraction failed for image {image_path}: {e}")
        return ""

async def extract_text_from_pdf_vision(pdf_path: str) -> tuple[str, int]:
    try:
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        pages_text = []
        
        settings = get_settings()
        
        for page_idx in range(page_count):
            page = doc.load_page(page_idx)
            # Render page to an image (matrix scales it up for better OCR readability)
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            b64_image = encode_image(img_bytes)
            
            messages = [
                {
                    "role": "user",
                    "content": VISION_PROMPT,
                    "images": [b64_image]
                }
            ]
            
            text = await ollama_client.chat(
                model=settings.MODEL_VISION,
                messages=messages,
                temperature=0.1
            )
            
            if text.strip():
                pages_text.append(f"[Page {page_idx + 1}]\n{text.strip()}")
                
        return "\n\n".join(pages_text), page_count
    except Exception as e:
        logger.error(f"Vision extraction failed for PDF {pdf_path}: {e}")
        return "", 0
