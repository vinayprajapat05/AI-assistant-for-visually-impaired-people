import os
import sys

TESSERACT_CMD = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

OLLAMA_MODEL = "llama3"  
OLLAMA_TIMEOUT = 30


if sys.platform.startswith('win'):
    if not os.path.exists(TESSERACT_CMD):
        print(f"WARNING: Tesseract executable not found at {TESSERACT_CMD}. Please update config.py.")
