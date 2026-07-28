import re
import json
import logging
from enum import Enum
from dataclasses import dataclass
from typing import Callable

from app.config import get_settings, Settings
from app.services.ollama_client import ollama_client

logger = logging.getLogger(__name__)


class Intent(Enum):
    """Enumeration of all supported user intents."""
    GENERAL = "general"
    CONVERSATIONAL = "conversational"
    COMPLEX = "complex"
    CODING = "coding"
    DOCUMENT_QA = "document_qa"


@dataclass(slots=True)
class ClassificationResult:
    """Represents the outcome of a message intent classification."""
    intent: Intent
    confidence: float
    source: str


# Immutable routing table mapping intents to functions that lazily retrieve models.
# This prevents holding stale references to settings and centralizes routing logic.
# Adding a new intent (e.g., Intent.SEARCH) only requires adding one line here.
ROUTING_TABLE: dict[Intent, Callable[[Settings], str]] = {
    Intent.GENERAL: lambda s: s.MODEL_GENERAL,
    Intent.CONVERSATIONAL: lambda s: s.MODEL_GENERAL,
    Intent.COMPLEX: lambda s: s.MODEL_COMPLEX,
    Intent.CODING: lambda s: s.MODEL_CODING,
    Intent.DOCUMENT_QA: lambda s: s.MODEL_COMPLEX,
}

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
    """Returns a user-friendly display name for a given model identifier."""
    return MODEL_DISPLAY_NAMES.get(model, model)


def get_model_for_intent(
    result: ClassificationResult | Intent | str,
    model_override: str | None = None,
) -> str:
    """
    Determines the appropriate model to use based on the classified intent.
    
    Priority:
    1. model_override (if provided)
    2. result (ClassificationResult, Intent, or string mapped via ROUTING_TABLE)
    3. Fallback to GENERAL intent model.
    """
    if model_override:
        return model_override

    # 1. Safely extract the Intent enum value
    intent_enum = Intent.GENERAL
    try:
        if isinstance(result, ClassificationResult):
            intent_enum = result.intent
        elif isinstance(result, Intent):
            intent_enum = result
        elif isinstance(result, str):
            # Attempt to map string directly to enum (case-insensitive)
            # This handles backwards compatibility if callers still pass raw strings.
            cleaned_str = result.strip().lower()
            intent_enum = Intent(cleaned_str)
    except ValueError:
        logger.warning(
            f"Invalid intent provided: '{result}'. Falling back to {Intent.GENERAL.name}."
        )
        intent_enum = Intent.GENERAL

    # 2. Look up the model retriever from the routing table
    model_retriever = ROUTING_TABLE.get(intent_enum)
    if not model_retriever:
        logger.error(
            f"Intent {intent_enum.name} is missing from ROUTING_TABLE. "
            f"Falling back to {Intent.GENERAL.name}."
        )
        model_retriever = ROUTING_TABLE[Intent.GENERAL]

    # 3. Resolve the model using the current settings
    settings = get_settings()
    selected_model = model_retriever(settings)
    
    logger.debug(f"Routed intent '{intent_enum.value}' to model '{selected_model}'")
    return selected_model


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


def _heuristic_classify(message: str, has_attached_docs: bool) -> ClassificationResult | None:
    """Uses fast pattern matching to classify intent without calling the LLM."""
    if has_attached_docs:
        return ClassificationResult(intent=Intent.DOCUMENT_QA, confidence=1.0, source="heuristic")

    lower = message.lower()
    code_score = sum(2 for p in CODE_PATTERNS if re.search(p, message))
    code_score += sum(1 for kw in CODE_KEYWORDS if kw in lower)

    if code_score >= 3:
        return ClassificationResult(intent=Intent.CODING, confidence=0.85, source="heuristic")

    complex_score = sum(1 for kw in COMPLEX_KEYWORDS if kw in lower)
    if complex_score >= 2 or len(message) > 500:
        return ClassificationResult(intent=Intent.COMPLEX, confidence=0.75, source="heuristic")

    if code_score >= 1 and len(message) > 200:
        return None  # Uncertain, defer to LLM

    if code_score == 0 and complex_score == 0:
        return ClassificationResult(intent=Intent.GENERAL, confidence=0.6, source="heuristic")

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
) -> ClassificationResult:
    """Classifies a user message and returns a confidence-scored ClassificationResult."""
    # 1. Attempt fast heuristic classification first
    heuristic_result = _heuristic_classify(user_message, has_attached_docs)
    if heuristic_result is not None:
        logger.info(f"Heuristic classification: {heuristic_result.intent.value}")
        return heuristic_result

    # 2. Fall back to LLM-based classification
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
        
        # Scan for recognized intent values
        for token in cleaned.split():
            try:
                intent_enum = Intent(token)
                logger.info(f"LLM classification: {intent_enum.value}")
                return ClassificationResult(intent=intent_enum, confidence=0.9, source="llm")
            except ValueError:
                continue
                
        logger.warning(f"LLM returned unexpected classification: {cleaned}. Defaulting to general.")
    except Exception as e:
        logger.error(f"Classification LLM call failed: {e}. Defaulting to general.")

    # Safe fallback
    return ClassificationResult(intent=Intent.GENERAL, confidence=0.0, source="fallback")
