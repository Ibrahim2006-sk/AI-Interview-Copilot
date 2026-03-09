from langdetect import detect

def detect_language(text: str) -> str:
    """Detects the language of the given text and returns the language code (e.g., 'en', 'es', 'hi')."""
    try:
        lang = detect(text)
        return lang
    except Exception as e:
        print(f"Error detecting language: {e}")
        return "en" # Default to English if detection fails
