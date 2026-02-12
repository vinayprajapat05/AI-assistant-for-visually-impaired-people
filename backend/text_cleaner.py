import re

def clean_text(raw_text: str) -> str:
    """
    Cleans raw OCR text using strict rule-based logic.
    Removes garbage, repeated symbols, and noise.
    """
    if not raw_text:
        return ""

    text = raw_text

    # 1. Remove non-alphanumeric garbage but keep basic punctuation
    # Allowed: letters, numbers, space, ., ,, !, ?, :, -, /, %, (, ), &, '
    # We replace anything else with a space
    text = re.sub(r'[^a-zA-Z0-9\s.,!?:/\-%\(\)&\'"]', ' ', text)

    # 2. Collapse repeated symbols
    text = re.sub(r'([!?.])\1+', r'\1', text)   # "!!" -> "!"
    text = re.sub(r'([-=])\1+', r'\1', text)    # "--" -> "-"

    # 3. Remove isolated single-letter noise
    # Matches single char surrounded by whitespace, checks if valid
    # Valid single chars: 'a', 'I', 'A', '&' (add others if needed like '1')
    # Numbers should be preserved (covered by [0-9] check usually, but let's be safe)
    
    def keep_single_char(match):
        char = match.group(0).strip()
        if char.isdigit():
            return match.group(0) # Keep numbers
        if char.lower() in ['a', 'i'] or char == '&':
            return match.group(0)
        return " " # Replace noise with space

    # Look for single chars. 
    # Logic: space + char + space. Be careful with start/end of string.
    text = re.sub(r'(?<=[\s^])[a-zA-Z](?=[\s$])', keep_single_char, text)

    # 4. Collapse excess whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    return text

if __name__ == "__main__":
    # Test cases
    sample = "Hel!lo  wor--ld $$ broken c h a r s 100%"
    print(f"Original: '{sample}'")
    print(f"Cleaned:  '{clean_text(sample)}'")
