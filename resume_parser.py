import pdfplumber
import io

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts text from a given PDF file bytes using pdfplumber."""
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        # Truncate to avoid huge context, saving token costs (e.g. keeping first 2000 chars)
        return text[:2000]
    except Exception as e:
        print(f"Error parsing PDF: {e}")
        return text
