"""AI provider management and text-to-SQL chat pipeline.

Everything here is pure logic (no Flask). The chat blueprint wires these
helpers into HTTP routes.
"""
from __future__ import annotations

import html
import os
import re
import sqlite3
import time
from typing import Any

import pandas as pd

from services.paths import MAX_RESULT_ROWS, TABLE_NAME

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover - handled at runtime if package is missing
    genai = None
    genai_types = None

try:
    from groq import Groq
except ImportError:  # pragma: no cover - handled at runtime if package is missing
    Groq = None  # type: ignore[assignment]


def build_gemini_providers() -> list[dict[str, str]]:
    default_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    provider_slots = [
        ("default", os.getenv("GEMINI_API_KEY"), os.getenv("GEMINI_MODEL", default_model)),
        ("1", os.getenv("GEMINI_API_KEY1"), os.getenv("GEMINI_MODEL1", default_model)),
        ("2", os.getenv("GEMINI_API_KEY2"), os.getenv("GEMINI_MODEL2", default_model)),
        ("3", os.getenv("GEMINI_API_KEY3"), os.getenv("GEMINI_MODEL3", default_model)),
        ("4", os.getenv("GEMINI_API_KEY4"), os.getenv("GEMINI_MODEL4", default_model)),
    ]

    providers: list[dict[str, str]] = []
    seen_keys: set[str] = set()
    for slot, api_key, model_name in provider_slots:
        if api_key and api_key not in seen_keys:
            providers.append({"slot": slot, "api_key": api_key, "model_name": model_name, "type": "gemini"})
            seen_keys.add(api_key)
    return providers


def build_groq_providers() -> list[dict[str, str]]:
    api_key = os.getenv("GROQ_API_KEY")
    model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    if not api_key or Groq is None:
        return []
    return [{"slot": "groq", "api_key": api_key, "model_name": model_name, "type": "groq"}]


def build_ai_system_instruction(schema_sql: str, table_name: str = "") -> str:
    allowed = table_name or TABLE_NAME
    return (
        "You are a precise text-to-SQL engine for a healthcare analytics dashboard. "
        "You must answer by generating only one SQLite SELECT statement. "
        "Do not explain your reasoning. Do not mention policies. Do not use markdown. "
        "Do not invent tables, columns, or external facts. Use only the schema provided below. "
        "If the user's question cannot be answered from this schema, return a single SELECT that yields a short error message as a column named message.\n\n"
        f"Schema:\n{schema_sql}\n\n"
        f"Allowed table: {allowed}."
    )


def build_ai_prompt(question: str, chart_id: str = "", custom_table_info: str = "") -> str:
    chart_context = f"\nCurrent chart context: {chart_id}" if chart_id else ""
    if custom_table_info:
        table_info = custom_table_info
    else:
        table_info = (
            'The ONLY table available is "clinics" with columns: '
            "Indicator, Month, Facility, Total_Visits, Monthly_Expenditure_USD, Cost_Per_ANC_Visit."
        )
    return (
        f"{table_info} "
        "Generate exactly one SQLite SELECT query for the question below. "
        "Return ONLY the raw SQL. No markdown fences, no commentary, no prose, no backticks. "
        "Use only SELECT or WITH clauses. Never use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, PRAGMA, ATTACH, or multiple statements.\n\n"
        f"Question: {question}{chart_context}"
    )


def select_ai_provider(providers: list[dict[str, str]], router_state: dict[str, Any]) -> tuple[int | None, dict[str, str] | None]:
    if not providers:
        return None, None

    now = time.monotonic()
    start_index = int(router_state.get("cursor", 0)) % len(providers)
    cooldowns = router_state.setdefault("cooldowns", {})

    for offset in range(len(providers)):
        provider_index = (start_index + offset) % len(providers)
        if cooldowns.get(provider_index, 0) <= now:
            router_state["cursor"] = provider_index + 1
            return provider_index, providers[provider_index]

    return None, None


def mark_provider_cooldown(router_state: dict[str, Any], provider_index: int | None, seconds: int) -> None:
    if provider_index is None:
        return
    cooldowns = router_state.setdefault("cooldowns", {})
    cooldowns[provider_index] = time.monotonic() + seconds


def is_quota_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(token in message for token in ["quota", "rate limit", "429", "exceeded"])


def create_gemini_model(schema_sql: str):
    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    if not api_key or genai is None:
        return None

    client = genai.Client(api_key=api_key)
    system_instruction = (
        "You are a precise text-to-SQL engine for a healthcare analytics dashboard. "
        "You must answer by generating only one SQLite SELECT statement. "
        "Do not explain your reasoning. Do not mention policies. Do not use markdown. "
        "Do not invent tables, columns, or external facts. Use only the schema provided below. "
        "If the user's question cannot be answered from this schema, return a single SELECT that yields a short error message as a column named message.\n\n"
        f"Schema:\n{schema_sql}\n\n"
        f"Allowed table: {TABLE_NAME}."
    )
    return {"client": client, "model_name": model_name, "system_instruction": system_instruction}


def generate_sql(
    providers: list[dict[str, str]],
    router_state: dict[str, Any],
    question: str,
    allowed_columns: list[str],
    schema_sql: str,
    chart_id: str = "",
    custom_table_info: str = "",
) -> tuple[str, str]:
    # AI-only mode: require a working Gemini provider and do not fall back to local heuristics.
    if not providers:
        raise ValueError("No Gemini providers are configured. The chat service requires at least one provider.")

    prompt = build_ai_prompt(question, chart_id, custom_table_info)
    table_name = "chart_data" if custom_table_info else TABLE_NAME
    system_instruction = build_ai_system_instruction(schema_sql, table_name)
    last_error: str | None = None

    for _ in range(max(1, len(providers))):
        provider_index, provider = select_ai_provider(providers, router_state)
        if provider is None:
            break

        try:
            provider_type = provider.get("type", "gemini")

            if provider_type == "groq":
                if Groq is None:
                    raise RuntimeError("Groq SDK is unavailable.")
                groq_client = Groq(api_key=provider["api_key"])
                groq_response = groq_client.chat.completions.create(
                    model=provider["model_name"],
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=500,
                    temperature=0.1,
                )
                raw_text = groq_response.choices[0].message.content or ""
            else:
                if genai is None:
                    raise RuntimeError("Gemini SDK is unavailable.")
                client = genai.Client(api_key=provider["api_key"])
                response = client.models.generate_content(
                    model=provider["model_name"],
                    contents=prompt,
                    config=genai_types.GenerateContentConfig(
                        system_instruction=system_instruction,
                    ),
                )
                raw_text = response.text or ""

            sql_text = extract_sql(raw_text)
            if not sql_text:
                raise ValueError(f"{provider_type} did not return a SQL query.")
            return sql_text, f"{provider_type}:{provider['slot']}", None
        except Exception as exc:
            last_error = str(exc)
            cooldown_seconds = 300 if is_quota_error(exc) else 45
            mark_provider_cooldown(router_state, provider_index, cooldown_seconds)
            continue

    # If we reach here no provider returned a SQL query.
    return None, "ai_error", last_error


def extract_sql(text: str) -> str:
    cleaned_text = text.strip()
    fenced_match = re.search(r"```sql\s*(.*?)\s*```", cleaned_text, flags=re.IGNORECASE | re.DOTALL)
    if fenced_match:
        cleaned_text = fenced_match.group(1).strip()
    cleaned_text = re.sub(r"^```(?:sql)?|```$", "", cleaned_text, flags=re.IGNORECASE).strip()
    return cleaned_text


def build_fallback_sql(question: str, allowed_columns: list[str]) -> str:
    normalized = re.sub(r"\s+", " ", question.lower()).strip()
    limit_match = re.search(r"\b(top|highest|first)\s+(\d+)\b", normalized)
    if limit_match:
        limit = int(limit_match.group(2))
    else:
        quantity_match = re.search(r"\b(\d+)\b", normalized)
        limit = int(quantity_match.group(1)) if quantity_match else 5

    spend_columns = ["monthly_expenditure_usd", "monthly expenditure", "budget", "cost", "spend"]
    visit_columns = ["total_visits", "visits", "volume", "attendance", "patients"]

    if any(token in normalized for token in ["how many", "count", "number of"]):
        if any(token in normalized for token in ["hospital", "hospitals", "facility", "facilities", "clinic", "clinics"]):
            return (
                "SELECT COUNT(DISTINCT Facility) AS hospital_count "
                "FROM clinics "
                "WHERE TRIM(COALESCE(Facility, '')) <> '' "
                "AND LOWER(TRIM(COALESCE(Facility, ''))) NOT IN ('kenya', 'unknown facility', 'national')"
            )
        if any(token in normalized for token in ["county", "counties"]):
            return (
                "SELECT COUNT(DISTINCT County) AS county_count "
                "FROM clinics "
                "WHERE TRIM(COALESCE(County, '')) <> ''"
            )
        if any(token in normalized for token in ["sub-county", "subcounty", "sub counties", "subcounties"]):
            return (
                "SELECT COUNT(DISTINCT SubCounty) AS subcounty_count "
                "FROM clinics "
                "WHERE TRIM(COALESCE(SubCounty, '')) <> ''"
            )

    if any(token in normalized for token in spend_columns):
        order_direction = "ASC" if any(token in normalized for token in ["lowest", "least", "smallest", "bottom"]) else "DESC"
        return (
            "SELECT Facility, Total_Visits, Monthly_Expenditure_USD, Cost_Per_ANC_Visit "
            f"FROM clinics ORDER BY Monthly_Expenditure_USD {order_direction} LIMIT {limit}"
        )

    if any(token in normalized for token in visit_columns):
        order_direction = "ASC" if any(token in normalized for token in ["lowest", "least", "smallest", "bottom"]) else "DESC"
        return (
            "SELECT Facility, Total_Visits, Monthly_Expenditure_USD, Cost_Per_ANC_Visit "
            f"FROM clinics ORDER BY Total_Visits {order_direction} LIMIT {limit}"
        )

    if "average" in normalized or "avg" in normalized:
        if any(token in normalized for token in spend_columns):
            return "SELECT ROUND(AVG(Monthly_Expenditure_USD), 2) AS average_monthly_expenditure_usd FROM clinics"
        if any(token in normalized for token in visit_columns):
            return "SELECT ROUND(AVG(Total_Visits), 2) AS average_total_visits FROM clinics"

    if "total" in normalized or "sum" in normalized:
        if any(token in normalized for token in spend_columns):
            return "SELECT ROUND(SUM(Monthly_Expenditure_USD), 2) AS total_monthly_expenditure_usd FROM clinics"
        if any(token in normalized for token in visit_columns):
            return "SELECT SUM(Total_Visits) AS total_visits FROM clinics"

    if "clinic" in normalized or "facility" in normalized:
        return (
            "SELECT Facility, Total_Visits, Monthly_Expenditure_USD, Cost_Per_ANC_Visit "
            f"FROM clinics ORDER BY Monthly_Expenditure_USD DESC LIMIT {limit}"
        )

    return "SELECT Facility, Total_Visits, Monthly_Expenditure_USD, Cost_Per_ANC_Visit FROM clinics ORDER BY Monthly_Expenditure_USD DESC LIMIT 5"


def validate_sql(sql_text: str, allowed_columns: list[str]) -> str:
    candidate = sql_text.strip()
    normalized = re.sub(r"\s+", " ", candidate).lower()

    if not candidate:
        raise ValueError("Empty SQL query returned by the model.")

    if ";" in candidate:
        raise ValueError("Multiple SQL statements are not allowed.")

    if not (normalized.startswith("select ") or normalized.startswith("with ")):
        raise ValueError("Only SELECT queries are allowed.")

    forbidden_terms = [
        " insert ",
        " update ",
        " delete ",
        " drop ",
        " alter ",
        " create ",
        " attach ",
        " pragma ",
        " vacuum ",
        " begin ",
        " commit ",
        " rollback ",
        " replace ",
        " detach ",
    ]
    padded = f" {normalized} "
    if any(term in padded for term in forbidden_terms):
        raise ValueError("Unsafe SQL keyword detected in the generated query.")

    if re.search(r"\bsqlite_master\b|\bsqlite_schema\b", normalized):
        raise ValueError("System tables are not allowed.")

    if not re.search(r"\bfrom\b|\bjoin\b", normalized):
        raise ValueError("SQL must query data from the clinics table or a CTE derived from it.")

    allowed_column_tokens = {f'"{column}"' for column in allowed_columns}
    allowed_column_tokens.update({f"[{column}]" for column in allowed_columns})
    _ = allowed_column_tokens  # Reserved for future stricter identifier validation.

    return candidate


def run_safe_query(connection: sqlite3.Connection, sql_text: str) -> pd.DataFrame:
    with connection:
        dataframe = pd.read_sql_query(sql_text, connection)

    if len(dataframe) > MAX_RESULT_ROWS:
        dataframe = dataframe.head(MAX_RESULT_ROWS).copy()
        dataframe.attrs["truncated"] = True
    else:
        dataframe.attrs["truncated"] = False

    return dataframe


def build_chat_response(question: str, sql_text: str, result_frame: pd.DataFrame, source: str, chart_id: str = "") -> dict:
    row_count = int(len(result_frame))
    truncated = bool(result_frame.attrs.get("truncated", False))
    normalized_question = question.lower()

    if result_frame.empty:
        if any(term in normalized_question for term in ["clinic", "clinics", "facility", "facilities"]) and any(
            term in normalized_question for term in ["spend", "expenditure", "budget", "cost"]
        ):
            summary = (
                "No clinic-level expenditure rows are available in the loaded CSVs. "
                "The current data is aggregated at county/national level, so clinic rankings cannot be produced reliably."
            )
        else:
            summary = f"No rows matched the question: {question}"
        html_block = f"<p class=\"text-sm text-slate-600\">{html.escape(summary)}</p>"
        return {
            "question": question,
            "sql": sql_text,
            "source": source,
            "summary": summary,
            "answer_html": html_block,
            "row_count": 0,
            "truncated": False,
            "columns": list(result_frame.columns),
            "rows": [],
        }

    summary = f"Returned {row_count} row{'s' if row_count != 1 else ''}."
    if source == "fallback":
        summary += " Gemini is rate-limited right now, so a local SQLite fallback answered this one."
    if source == "local":
        summary += " This answer was computed locally to avoid an unnecessary model call."
    if source == "no_gemini":
        summary += " Gemini is not configured in this environment, so a local SQLite fallback answered this one."
    if chart_id:
        summary += f" Chart context: {chart_id}."
    if truncated:
        summary += f" Showing the first {MAX_RESULT_ROWS}."

    html_block = [f"<p class=\"text-sm text-slate-600 mb-3\">{html.escape(summary)}</p>"]
    html_block.append(render_html_table(result_frame))

    return {
        "question": question,
        "sql": sql_text,
        "source": source,
        "summary": summary,
        "answer_html": "".join(html_block),
        "row_count": row_count,
        "truncated": truncated,
        "columns": list(result_frame.columns),
        "rows": result_frame.to_dict(orient="records"),
    }


def render_html_table(dataframe: pd.DataFrame) -> str:
    header_cells = "".join(
        f'<th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">{html.escape(str(column))}</th>'
        for column in dataframe.columns
    )

    body_rows = []
    for row in dataframe.itertuples(index=False, name=None):
        cells = []
        for value in row:
            cell_value = "" if pd.isna(value) else str(value)
            cells.append(
                f'<td class="px-3 py-2 text-sm text-slate-700 border-b border-slate-100 whitespace-nowrap">{html.escape(cell_value)}</td>'
            )
        body_rows.append(f"<tr>{''.join(cells)}</tr>")

    return (
        '<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">'
        '<table class="min-w-full divide-y divide-slate-200">'
        f"<thead><tr>{header_cells}</tr></thead>"
        f"<tbody>{''.join(body_rows)}</tbody>"
        "</table></div>"
    )
