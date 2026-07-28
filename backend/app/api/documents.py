import os
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import get_db
from app.models.models import User, Document
from app.schemas.schemas import DocumentResponse, DocumentStatusResponse
from app.services.auth import get_current_user
from app.services.rag import ingest_document
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    session_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Document).where(Document.user_id == user.id)
    if session_id is not None:
        stmt = stmt.where(Document.session_id == session_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    session_id: int | None = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported. Allowed: {', '.join(allowed)}")

    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    doc = Document(
        user_id=user.id,
        session_id=session_id,
        filename=file.filename or "unnamed",
        status="processing",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    file_path = os.path.join(settings.UPLOAD_DIR, f"{doc.id}{ext}")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    background_tasks.add_task(_process_document, doc.id, file_path)

    return doc


async def _process_document(document_id: int, file_path: str):
    from app.models.database import async_session
    try:
        await ingest_document(file_path, document_id)
        async with async_session() as db:
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one()
            doc.status = "ready"
            await db.commit()
        logger.info(f"Document {document_id} processed successfully")
    except Exception as e:
        logger.error(f"Document {document_id} processing failed: {e}")
        async with async_session() as db:
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one()
            doc.status = "error"
            await db.commit()


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    document_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user.id
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user.id
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    from app.services.rag import delete_document_vectors
    try:
        await delete_document_vectors(document_id)
    except Exception as e:
        logger.warning(f"Failed to delete vectors for doc {document_id}: {e}")

    settings = get_settings()
    for ext in [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"]:
        path = os.path.join(settings.UPLOAD_DIR, f"{document_id}{ext}")
        if os.path.exists(path):
            os.remove(path)

    await db.delete(doc)
    await db.commit()
