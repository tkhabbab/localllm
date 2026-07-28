import re
import json
import logging

from app.config import get_settings
from app.services.ollama_client import ollama_client

logger = logging.getLogger(__name__)

CODE_PATTERNS = [
    r"```",
    r"\bdef\s+\w+",
    r"\bfunction\s+\w+",
    r"\bclass\s+\w+",
    r"\bimport\s+\w+",
    r"\bconst\s+\w+",
    r"\bvar\s+\w+",
    r"\blet\s+\w+",
    r"->|=>",
    r"\{\s*\}",
    r"\[\s*\]",
    r"//\s*\w+",
    r"/\*",
]

CODE_KEYWORDS = {
    "bug", "debug", "error", "stack trace", "stacktrace", "traceback",
    "compile", "syntax", "runtime", "exception", "segfault", "null pointer",
    "code", "program", "script", "algorithm", "refactor", "optimize",
    "implement", "function", "method", "class", "api", "endpoint",
    "database", "query", "sql", "html", "css", "javascript", "python",
    "java", "rust", "golang", "typescript", "react", "node", "docker",
    "kubernetes", "git", "bash", "shell", "terminal", "command line",
    "regex", "unit test", "integration test", "ci/cd", "deploy",
    "webpack", "npm", "pip", "cargo", "makefile", "dockerfile",
}

COMPLEX_KEYWORDS = {
    "explain in detail", "analyze", "compare and contrast", "deep dive",
    "pros and cons", "trade-offs", "tradeoffs", "architecture",
    "design pattern", "system design", "comprehensive", "thorough",
    "step by step", "elaborate", "in-depth", "detailed analysis",
    "philosophical", "ethical implications", "research", "whitepaper",
    "academic", "theoretical",
}


def _heuristic_classify(message: str, has_attached_docs: bool) -> str | None:
    if has_attached_docs:
        return "document_qa"

    lower = message.lower()

    code_score = 0
    for pattern in CODE_PATTERNS:
        if re.search(pattern, message):
            code_score += 2

    for kw in CODE_KEYWORDS:
        if kw in lower:
            code_score += 1

    if code_score >= 3:
        return "coding"

    complex_score = sum(1 for kw in COMPLEX_KEYWORDS if kw in lower)
    if complex_score >= 2 or len(message) > 500:
        return "complex"

    if code_score >= 1 and len(message) > 200:
        return None

    if code_score == 0 and complex_score == 0:
        return "general"

    return None


CLASSIFICATION_PROMPT = """Your job is to analyze every user request and select the most appropriate model category before answering.
You are an expert message classifier for an enterprise AI system. Your ONLY task is to output EXACTLY ONE word that represents the category of the user's message.

Categories available:
- general: Simple greetings, yes/no answers, short questions, or factual lookups that require minimal reasoning.
- conversational: Creative writing, translations, summarizing long text, or broad conversational topics.
- complex: Advanced logic, math, system architecture design, comparing/contrasting, or deep analytical reasoning.
- coding: Writing code, debugging, analyzing stack traces, reviewing scripts, or database queries.
- document_qa: Questions that explicitly ask about an uploaded document, file, or image.

User message: {message}

You must respond with ONLY ONE WORD from the list above. No explanations.
Category:"""


async def classify_intent(
    user_message: str, has_attached_docs: bool = False
) -> str:
    result = _heuristic_classify(user_message, has_attached_docs)
    if result is not None:
        logger.info(f"Heuristic classification: {result}")
        return result

    settings = get_settings()
    try:
        response = await ollama_client.chat(
            model=settings.MODEL_FAST,
            messages=[
                {"role": "user", "content": CLASSIFICATION_PROMPT.format(message=user_message[:500])}
            ],
            temperature=0.1,
        )
        cleaned = response.strip().lower().rstrip(".")
        for token in cleaned.split():
            if token in ("general", "conversational", "complex", "coding", "document_qa"):
                logger.info(f"LLM classification: {token}")
                return token
        logger.warning(f"LLM returned unexpected classification: {cleaned}, defaulting to general")
        return "general"
    except Exception as e:
        logger.error(f"Classification LLM call failed: {e}, defaulting to general")
        return "general"


def get_model_for_intent(intent: str, model_override: str | None = None) -> str:
    if model_override:
        return model_override
    
    settings = get_settings()
    mapping = {
        "general": settings.MODEL_GENERAL,
        "conversational": settings.MODEL_GENERAL,
        "complex": settings.MODEL_COMPLEX,
        "coding": settings.MODEL_CODING,
        "document_qa": settings.MODEL_COMPLEX,
    }
    return mapping.get(intent, settings.MODEL_GENERAL)


MODEL_DISPLAY_NAMES = {
    "qwen2.5:7b": "Qwen2.5 7B (General)",
    "qwen2.5:32b": "Qwen2.5 32B (Complex)",
    "qwen2.5-coder:32b": "Qwen2.5 Coder 32B (Coding)",
    "qwen3:32b": "Qwen3 32B",
    "qwen3.6:27b": "Qwen3.6 27B",
    "gemma4:26b": "Gemma4 26B",
    "llama3.2-vision:latest": "Llama 3.2 Vision",
    "bge-m3:latest": "BGE-M3 (Embeddings)",
}


def get_model_display_name(model: str) -> str:
    return MODEL_DISPLAY_NAMES.get(model, model)
