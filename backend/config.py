import os
import sys

# Tesseract Configuration
# Common default installation path for Windows. 
# Update this if Tesseract is installed elsewhere.
TESSERACT_CMD = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Ollama Configuration
OLLAMA_MODEL = "llama3"  # User requested llama3 for better explanations
OLLAMA_TIMEOUT = 30  # Seconds (not always strictly enforceable via simple API, but good for design)

# Validation
if sys.platform.startswith('win'):
    if not os.path.exists(TESSERACT_CMD):
        print(f"WARNING: Tesseract executable not found at {TESSERACT_CMD}. Please update config.py.")
