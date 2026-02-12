import ollama
import json
from config import OLLAMA_MODEL

def summarize(clean_text: str) -> dict:
    """
    Sends cleaned text to Ollama for summarization.
    Returns a dictionary with the summary.
    """
    if not clean_text or len(clean_text.strip()) < 5:
        return {"summary": "No readable text found on the image."}

    system_prompt = (
        "You are an assistant for visually impaired people. "
        "You will receive text extracted from an image via OCR. "
        "Your job is to summarize this text in simple, spoken-friendly sentences.\n\n"
        "Follow these rules:\n"
        "1. First, determine what type of text it is (e.g., product label, document, sign, receipt, menu, letter, notice, book page, handwritten note, or other).\n"
        "2. If it is a PRODUCT LABEL, provide a detailed explanation including: "
        "product name, brand, product type/category, key ingredients or contents, "
        "nutritional information (if present), expiry or best-before date, "
        "usage instructions, storage instructions, warnings or allergens, "
        "manufacturer details, and net weight/volume. "
        "If any critical info is missing or unclear, mention: 'Some details are unclear on the label.'\n"
        "3. If it is ANY OTHER type of text (document, sign, notice, receipt, book page, etc.), "
        "provide a clear and concise summary of the content. "
        "Mention what type of text it appears to be, then summarize the key information.\n"
        "4. Use simple language suitable for someone who cannot see the original image.\n"
        "5. Do NOT hallucinate or add information not present in the text.\n"
        "6. Return strictly JSON format: {\"summary\": \"...\"}."
    )

    try:
        response = ollama.chat(model=OLLAMA_MODEL, messages=[
            {
                'role': 'system',
                'content': system_prompt,
            },
            {
                'role': 'user',
                'content': clean_text,
            },
        ])

        content = response['message']['content']
        
        # Simple extraction of JSON if model adds fluff around it
        # Try to find { ... }
        start = content.find('{')
        end = content.rfind('}')
        if start != -1 and end != -1:
            json_str = content[start:end+1]
            return json.loads(json_str)
        else:
            # Fallback if valid JSON not found
            return {"summary": content.strip()}

    except Exception as e:
        return {"summary": f"Error generating summary: {str(e)}"}

if __name__ == "__main__":
    sample_text = "TOMATO KETCHUP. Ingredients: Tomatoes, Sugar, Salt. Best before 12/2025."
    print(summarize(sample_text))
