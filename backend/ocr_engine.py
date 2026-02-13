import pytesseract
from PIL import Image
import os
import sys
from config import TESSERACT_CMD

pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

from pytesseract import Output
from PIL import Image, ImageDraw, ImageEnhance

def extract_text(image_path: str):
    """
    Extracts text and returns both the text string and the image with detected text highlighted.
    Returns: (text, highlighted_image_obj)
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    try:

        with Image.open(image_path) as img:
            img = img.convert('RGB')
            img = img.resize((img.width * 2, img.height * 2), Image.Resampling.BICUBIC)
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.5) 
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(2.0)
            custom_config = r'--oem 3 --psm 3'
            data = pytesseract.image_to_data(img, lang='eng', config=custom_config, output_type=Output.DICT)
            text_parts = []
            draw = ImageDraw.Draw(img)
            
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                word_text = data['text'][i].strip()
                conf = int(data['conf'][i])
                
                if word_text and conf > 40:
                    text_parts.append(word_text)
                    (x, y, w, h) = (data['left'][i], data['top'][i], data['width'][i], data['height'][i])
                    draw.rectangle([(x, y), (x + w, y + h)], outline="red", width=4)

            full_text = " ".join(text_parts)
            return full_text, img

    except Exception as e:
        raise RuntimeError(f"OCR failed: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(extract_text(sys.argv[1]))
    else:
        print("Usage: python ocr_engine.py <image_path>")
