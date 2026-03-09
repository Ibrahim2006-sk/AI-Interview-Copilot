from deep_translator import GoogleTranslator

def translate_to_english(text: str, source_lang: str) -> str:
    """Translates text from source language to English."""
    if source_lang == 'en':
        return text
    try:
        # deep-translator handles auto-detection via "auto" if preferred, but we got source_lang.
        translator = GoogleTranslator(source=source_lang, target='en')
        return translator.translate(text)
    except Exception as e:
        print(f"Error translating to English: {e}")
        return text

def translate_from_english(text: str, target_lang: str) -> str:
    """Translates text from English to target language."""
    if target_lang == 'en':
        return text
    try:
        translator = GoogleTranslator(source='en', target=target_lang)
        return translator.translate(text)
    except Exception as e:
        print(f"Error translating from English: {e}")
        return text
