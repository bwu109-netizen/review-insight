"""Step 0: check that your API key works and which Flash models you can use.

Usage:
    python src/check_api.py
"""
import config
from llm_client import GeminiClient, LLMError, get_client


def main() -> None:
    print(f"Provider in .env: {config.PROVIDER}")
    if config.PROVIDER == "gemini":
        try:
            models = GeminiClient().list_models()
        except Exception as e:  # noqa: BLE001
            print(f"Could not list models: {e}")
            return
        flash = [m for m in models if "flash" in m]
        print("Flash models on your key:", ", ".join(flash) or "(none)")
        print(f"GEMINI_MODEL in .env: {config.GEMINI_MODEL}")
    try:
        out = get_client().complete_json(
            "Reply in JSON.", 'Return {"ok": true, "tea": "<one word describing green tea>"}'
        )
        print("Test call OK:", out)
    except LLMError as e:
        print("Test call FAILED:", e)


if __name__ == "__main__":
    main()
