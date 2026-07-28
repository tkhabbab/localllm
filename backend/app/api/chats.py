import json
import time
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, func

from app.models.database import get_db
from app.models.models import User, ChatSession, Message, Document
from app.schemas.schemas import (
    ChatSessionCreate, ChatSessionResponse,
    MessageCreate, MessageResponse,
)
from app.services.auth import get_current_user
from app.services.router import classify_intent, get_model_for_intent, get_model_display_name
from app.services.ollama_client import ollama_client
from app.services.rag import retrieve_context
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chats", tags=["chats"])


@router.get("", response_model=list[ChatSessionResponse])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(desc(ChatSession.updated_at))
    )
    return result.scalars().all()


@router.post("", response_model=ChatSessionResponse, status_code=201)
async def create_session(
    data: ChatSessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(user_id=user.id, title=data.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/{session_id}", response_model=ChatSessionResponse)
async def get_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    await db.delete(session)
    await db.commit()


@router.patch("/{session_id}", response_model=ChatSessionResponse)
async def update_session(
    session_id: int,
    data: ChatSessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    if data.title is not None:
        session.title = data.title
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chat session not found")

    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()


@router.post("/{session_id}/messages")
async def send_message(
    session_id: int,
    data: MessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == user.id
        )
    )
    chat_session = result.scalar_one_or_none()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    user_msg = Message(
        session_id=session_id,
        role="user",
        content=data.content,
    )
    db.add(user_msg)
    await db.commit()

    import asyncio

    # Fetch all documents associated with this session (both ready and processing)
    doc_result = await db.execute(
        select(Document).where(
            Document.session_id == session_id,
            Document.status.in_(["ready", "processing"]),
        )
    )
    attached_docs = doc_result.scalars().all()

    # If any document is still processing in the background, wait for it
    for doc in attached_docs:
        if doc.status == "processing":
            logger.info(f"Chat sending started: waiting for document {doc.id} ({doc.filename}) to finish indexing...")
            for _ in range(80):  # Max 40 seconds timeout
                await asyncio.sleep(0.5)
                # Query the database directly to prevent session cache issues
                status_res = await db.execute(select(Document).where(Document.id == doc.id))
                refreshed_doc = status_res.scalar_one_or_none()
                if not refreshed_doc or refreshed_doc.status != "processing":
                    if refreshed_doc:
                        doc.status = refreshed_doc.status
                    break

    # Filter documents to only include successfully processed ones (ready)
    attached_docs = [doc for doc in attached_docs if doc.status == "ready"]
    has_docs = len(attached_docs) > 0

    start_time = time.time()
    classification = await classify_intent(data.content, has_docs)
    intent_str = classification.intent.value
    model = get_model_for_intent(classification, data.model_override)
    display_name = get_model_display_name(model)

    history_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
        .limit(50)
    )
    history = history_result.scalars().all()

    messages = []
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    system_instruction = (
        "You must always reply in the same language as the user's query. "
        "If the user asks a question in Banglish (Bengali language written using Latin/English characters, "
        "e.g., 'kemon acho', 'ki khobor', 'ami bhalo achi'), you must reply in pure Bengali script (বাংলা)."
    )

    if has_docs and intent_str == "document_qa":
        context_text = ""
        for doc in attached_docs:
            ctx = await retrieve_context(data.content, doc.id)
            if ctx:
                context_text += f"\n\n--- Document: {doc.filename} ---\n{ctx}"

        if context_text:
            system_instruction += (
                f"\n\nUse the following document context to answer the user's question. "
                f"Cite the source document and page numbers when possible.\n{context_text}"
            )

    messages.insert(0, {
        "role": "system",
        "content": system_instruction,
    })

    if not chat_session.title and len(history) <= 2:
        title = data.content[:80]
        chat_session.title = title
        await db.commit()

    async def stream_response():
        full_response = ""
        try:
            yield f"data: {json.dumps({'type': 'meta', 'intent': intent_str, 'model': display_name})}\n\n"

            async for chunk in ollama_client.chat_stream(model, messages):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            latency = time.time() - start_time
            logger.info(
                f"Chat completed: intent={intent_str}, model={model}, "
                f"latency={latency:.2f}s, tokens~{len(full_response.split())}"
            )

            assistant_msg = Message(
                session_id=session_id,
                role="assistant",
                content=full_response,
                model_used=model,
            )
            db.add(assistant_msg)
            await db.execute(
                update(ChatSession)
                .where(ChatSession.id == session_id)
                .values(updated_at=func.now())
            )
            await db.commit()

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
