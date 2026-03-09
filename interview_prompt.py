def get_interview_prompt(interview_type: str, question: str, resume_context: str = "") -> str:
    """Generates the professional prompt layout for the LLM."""
    base_prompt = """You are a professional interview coach with expertise in HR, technical, and behavioral interviews.
Your job is to generate a strong and professional answer to the interview question provided.

Rules:
- Use formal and professional tone.
- Provide a structured response.
- Keep the answer clear and concise.
- Use confident language.
- Avoid unnecessary filler words.

Structure guidelines:
1. Introduction
2. Main Explanation
3. Example (if useful)
4. Conclusion

Generate the final output formatted in Markdown, utilizing the structure mentioned.
"""
    context_str = f"\nApplicant's Resume Context:\n\"\"\"{resume_context}\"\"\"\nBase your answer slightly around the applicant's experience if applicable.\n" if resume_context else ""
    
    prompt = f"{base_prompt}\nInterview Type: {interview_type}{context_str}\nInterview Question:\n\"{question}\"\n\nPlease provide the structural response:"
    return prompt
