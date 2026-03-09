import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# We initialize a client dynamically or globally. 
def get_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key and api_key != "your-api-key-here":
        return OpenAI(api_key=api_key)
    return None

def generate_interview_answer(prompt: str, language: str = "English") -> str:
    """Generates an interview answer using OpenAI API (gpt-4o-mini for speed)."""
    client = get_client()
    
    if not client:
        return """### Introduction
Thank you for asking this question. I appreciate the opportunity to discuss my approach and expertise in this area.

### Main Explanation
In my professional experience, clear communication and a structured methodology are paramount. When faced with situations like this, I always prioritize understanding the core objectives before acting. By collaborating closely with stakeholders and leveraging my analytical skills, I am able to devise effective and efficient solutions. 

### Example
For instance, in a recent project, I encountered a complex challenge that required quick adaptation. Instead of rushing, I broke the problem down into manageable components, communicated my strategy, and implemented a phased solution. This approach not only solved the core issue but resulted in delivering the milestone ahead of schedule.

### Conclusion
Overall, my proactive mindset, combined with an ability to adapt and think critically, ensures that I can handle similar scenarios successfully and bring value to the team."""
        
    try:
        # We tell the model to respond in the target language directly to save translation time
        lang_instruction = f" Respond purely in {language}." if language != "auto" else ""
        
        response = client.chat.completions.create(
            model="gpt-4o-mini", # Much faster than 3.5-turbo
            messages=[
                {"role": "system", "content": f"You are a professional interview coach. Output structured Markdown.{lang_instruction}"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=600
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error generating answer: {e}"
