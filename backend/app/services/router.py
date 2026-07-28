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


CLASSIFICATION_PROMPT = """You are a message classifier. Classify the user's message into exactly one category.
Reply with ONLY one word: general, conversational, complex, coding, or document_qa

Categories:
- general: casual greetings, yes/no, short responses, simple queries
- conversational: creative writing, translation, long summaries, conversational answers, explanations
- complex: math, logic, system architecture, comparison, deep analytical reasoning
- coding: writing code, debugging, scripts, database queries
- document_qa: questions about uploaded documents (only if referencing a document)

User message: {message}

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
    
    # Auto-mode mappings for all 5 chat models on the server:
    mapping = {
        "general": "qwen2.5:7b",
        "conversational": "qwen3.6:27b",
        "complex": "qwen2.5:32b",
        "coding": "qwen2.5-coder:32b",
        "document_qa": "qwen3:32b",
    }
    return mapping.get(intent, "qwen2.5:7b")


MODEL_DISPLAY_NAMES = {
    "qwen2.5:7b": "Qwen2.5 7B (General)",
    "qwen2.5:32b": "Qwen2.5 32B (Complex)",
    "qwen2.5-coder:32b": "Qwen2.5 Coder 32B (Coding)",
    "qwen3:32b": "Qwen3 32B",
    "qwen3.6:27b": "Qwen3.6 27B",
    "bge-m3:latest": "BGE-M3 (Embeddings)",
}


def get_model_display_name(model: str) -> str:
    return MODEL_DISPLAY_NAMES.get(model, model)
