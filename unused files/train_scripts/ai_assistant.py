import os
import re

import streamlit as st
from dotenv import load_dotenv

try:
    from google import genai
except ImportError:
    genai = None


st.set_page_config(page_title="CHAK AI Assistant", page_icon="🤖", layout="wide")

st.markdown(
    """
    <style>
    .assistant-launcher-anchor + div {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 9999;
        width: 72px;
        height: 72px;
        margin: 0;
    }

    .assistant-launcher-anchor + div > div {
        background: rgba(255, 255, 255, 0.97);
        border: 1px solid rgba(20, 58, 102, 0.16);
        border-radius: 999px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
        padding: 0.15rem;
        backdrop-filter: blur(12px);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .assistant-launcher-anchor + div [data-testid="stButton"] button {
        width: 100%;
        height: 60px;
        width: 60px;
        min-width: 60px;
        border-radius: 50%;
        font-weight: 700;
        background: linear-gradient(135deg, #143a66, #2a6bc0);
        color: white;
        border: none;
        font-size: 1.35rem;
        padding: 0;
    }

    .assistant-popup-anchor + div {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 10000;
        width: 340px;
        max-width: calc(100vw - 40px);
        margin: 0;
    }

    .assistant-popup-anchor + div > div {
        background: rgba(255, 255, 255, 0.98);
        border: 1px solid rgba(20, 58, 102, 0.16);
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
        padding: 0.9rem;
        backdrop-filter: blur(14px);
    }

    .assistant-popup-anchor + div [data-testid="stTextInput"] input,
    .assistant-popup-anchor + div [data-testid="stTextArea"] textarea {
        border-radius: 12px;
        border: 1px solid rgba(20, 58, 102, 0.18);
    }

    .assistant-popup-thread {
        max-height: 280px;
        overflow-y: auto;
        padding-right: 0.25rem;
        margin-bottom: 0.75rem;
    }

    .assistant-popup-anchor + div [data-testid="stButton"] button {
        border-radius: 999px;
        height: 40px;
        font-weight: 650;
    }

    .assistant-popup-anchor + div [data-testid="stPopover"] button {
        width: 100%;
        border-radius: 999px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

if not api_key:
    st.error("🚨 API Key not found. Please add GEMINI_API_KEY to your .env file.")
    st.stop()

if genai is None:
    st.error("🚨 The google-genai package is not installed.")
    st.stop()

client = genai.Client(api_key=api_key)

if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": "Hello! I am your CHAK AI assistant. Click AI Assist to open the popup box and ask a question.",
        }
    ]


def build_prompt(user_prompt: str) -> str:
    return (
        "You are a Senior Monitoring & Evaluation Data Analyst for CHAK in Kenya. "
        "Answer concisely and professionally. Start with a short brief sentence, then a short explanation "
        "about the data source and meaning, and include a tiny markdown table if helpful.\n\n"
        f"User question: {user_prompt}"
    )


def ask_gemini(user_prompt: str) -> str:
    response = client.models.generate_content(
        model=model_name,
        contents=build_prompt(user_prompt),
    )
    text = getattr(response, "text", "").strip()
    return re.sub(r"```sql.*?```", "", text, flags=re.DOTALL | re.IGNORECASE).strip()


st.title("🤖 CHAK Data Assistant")
st.markdown("Ask me anything about the network's efficiency, clinical volume, or financial burn rates.")

st.markdown('<div class="assistant-launcher-anchor"></div>', unsafe_allow_html=True)

with st.container():
    with st.popover("💬 AI Assist", use_container_width=True):
        st.markdown('<div class="assistant-popup-anchor"></div>', unsafe_allow_html=True)
        st.markdown("**AI Assist**")
        st.caption("Compact help bubble for quick questions.")

        st.markdown("<div class='assistant-popup-thread'>", unsafe_allow_html=True)
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])
        st.markdown("</div>", unsafe_allow_html=True)

        with st.form("assistant_form", clear_on_submit=True):
            user_prompt = st.text_input(
                "Ask the assistant",
                placeholder="Ask about ANC visits, spending, or clinic performance...",
                key="assistant_prompt_input",
                label_visibility="collapsed",
            )

            send_col, reset_col = st.columns(2)
            with send_col:
                submitted = st.form_submit_button("Send", use_container_width=True)
            with reset_col:
                reset_pressed = st.form_submit_button("Reset", use_container_width=True)

        if submitted:
            if user_prompt.strip():
                st.session_state.messages.append({"role": "user", "content": user_prompt.strip()})
                with st.spinner("Thinking..."):
                    reply = ask_gemini(user_prompt.strip())
                st.session_state.messages.append({"role": "assistant", "content": reply or "I could not generate a response."})
                st.rerun()
            else:
                st.warning("Type a question first.")

        if reset_pressed:
            st.session_state.messages = [st.session_state.messages[0]]
            st.rerun()