import argparse
import sys
import json
import time
from ocr_engine import extract_text
from text_cleaner import clean_text
from summarizer import summarize

def main():
    parser = argparse.ArgumentParser(description="AI Assistant for Visually Impaired People - Product Label Summarizer")
    parser.add_argument("--image", type=str, required=True, help="Path to the image file")
    parser.add_argument("--verbose", action="store_true", help="Print intermediate outputs (OCR text, cleaned text)")
    
    args = parser.parse_args()
    
    start_time = time.time()
    
    print(f"Processing image: {args.image}...", file=sys.stderr)
    try:
        raw_text = extract_text(args.image)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    if args.verbose:
        print("--- RAW OCR OUTPUT ---", file=sys.stderr)
        print(raw_text, file=sys.stderr)
        print("----------------------", file=sys.stderr)

    cleaned_text = clean_text(raw_text)
    
    if args.verbose:
        print("--- CLEANED TEXT ---", file=sys.stderr)
        print(cleaned_text, file=sys.stderr)
        print("--------------------", file=sys.stderr)


    if not cleaned_text.strip():
        result = {"summary": "No readable text found on the image."}
    else:
        result = summarize(cleaned_text)


    print(json.dumps(result, indent=2))
    
    end_time = time.time()
    if args.verbose:
        print(f"Processing time: {end_time - start_time:.2f}s", file=sys.stderr)

if __name__ == "__main__":
    main()
