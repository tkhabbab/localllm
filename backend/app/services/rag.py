import os
import logging
import asyncio
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue,
)
import pypdf

from app.config import get_settings
from app.services.ollama_client import ollama_client
from app.services.ocr import extract_text_from_image, extract_text_from_pdf_ocr

logger = logging.getLogger(__name__)

COLLECTION_NAME = "documents"
VECTOR_DIM = 1024
CHUNK_SIZE = 600
CHUNK_OVERLAP = 90


def _get_qdrant() -> QdrantClient:
    settings = get_settings()
    return QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)


def _ensure_collection(client: QdrantClient):
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start = end - overlap
    return chunks


def _extract_pdf_text(pdf_path: str) -> tuple[str, int, bool]:
    try:
        reader = pypdf.PdfReader(pdf_path)
        page_count = len(reader.pages)
        text_parts = []
        has_text = False
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                has_text = True
                text_parts.append(f"[Page {i + 1}]\n{page_text}")
        return "\n\n".join(text_parts), page_count, has_text
    except Exception as e:
        logger.warning(f"pypdf extraction failed: {e}")
        return "", 0, False


async def ingest_document(file_path: str, document_id: int):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        text, page_count, has_text = _extract_pdf_text(file_path)
        if not has_text:
            logger.info(f"PDF {document_id} has no text layer, using OCR")
            text, page_count = await asyncio.to_thread(extract_text_from_pdf_ocr, file_path)
    elif ext in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        text = await asyncio.to_thread(extract_text_from_image, file_path)
        page_count = 1
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    if not text.strip():
        logger.warning(f"No text extracted from document {document_id}")
        from app.models.database import async_session
        from sqlalchemy import select
        from app.models.models import Document
        async with async_session() as db:
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one()
            doc.page_count = page_count
            await db.commit()
        return

    chunks = _chunk_text(text)
    logger.info(f"Document {document_id}: {len(chunks)} chunks from {page_count} pages")

    embeddings = await ollama_client.embed([c for c in chunks])

    client = _get_qdrant()
    _ensure_collection(client)

    points = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        points.append(
            PointStruct(
                id=document_id * 100000 + i,
                vector=embedding,
                payload={
                    "document_id": document_id,
                    "chunk_index": i,
                    "text": chunk,
                },
            )
        )

    batch_size = 100
    for i in range(0, len(points), batch_size):
        client.upsert(collection_name=COLLECTION_NAME, points=points[i:i + batch_size])

    from app.models.database import async_session
    from sqlalchemy import select
    from app.models.models import Document
    async with async_session() as db:
        result = await db.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one()
        doc.page_count = page_count
        await db.commit()

    logger.info(f"Document {document_id} ingested: {len(points)} vectors stored")


async def retrieve_context(query: str, document_id: int, top_k: int = 5) -> str:
    try:
        query_embedding = (await ollama_client.embed(query))[0]

        client = _get_qdrant()
        _ensure_collection(client)

        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_embedding,
            query_filter=Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            ),
            limit=top_k,
        )

        if not results:
            return ""

        chunks = sorted(results, key=lambda r: r.payload.get("chunk_index", 0))
        context_parts = [r.payload["text"] for r in chunks]
        return "\n\n".join(context_parts)

    except Exception as e:
        logger.error(f"RAG retrieval failed: {e}")
        return ""


async def delete_document_vectors(document_id: int):
    try:
        client = _get_qdrant()
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            ),
        )
    except Exception as e:
        logger.warning(f"Failed to delete vectors for document {document_id}: {e}")
