import re

def clean_text(raw_text: str) -> str:
    """
    Cleans raw OCR text using strict rule-based logic.
    Removes garbage, repeated symbols, and noise.
    """
    if not raw_text:
        return ""

    text = raw_text
    text = re.sub(r'[^a-zA-Z0-9\s.,!?:/\-%\(\)&\'"]', ' ', text)

    text = re.sub(r'([!?.])\1+', r'\1', text) 
    text = re.sub(r'([-=])\1+', r'\1', text) 

    
    def keep_single_char(match):
        char = match.group(0).strip()
        if char.isdigit():
            return match.group(0) 
        if char.lower() in ['a', 'i'] or char == '&':
            return match.group(0)
        return " " 

    text = re.sub(r'(?<=[\s^])[a-zA-Z](?=[\s$])', keep_single_char, text)

    text = re.sub(r'\s+', ' ', text).strip()

    return text

if __name__ == "__main__":
    sample = "Hel!lo  wor--ld $$ broken c h a r s 100%"
    print(f"Original: '{sample}'")
    print(f"Cleaned:  '{clean_text(sample)}'")
