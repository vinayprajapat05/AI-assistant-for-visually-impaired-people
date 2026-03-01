import pytesseract
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import os
import sys
import numpy as np
from config import TESSERACT_CMD

pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

from pytesseract import Output


def _preprocess_variant(img, variant="default"):
    """
    Apply different preprocessing pipelines to handle various font styles and sizes.
    Each variant is optimized for a different type of text.
    """
    try:
        processed = img.copy()

        if variant == "default":
            processed = processed.convert('L')
            enhancer = ImageEnhance.Contrast(processed)
            processed = enhancer.enhance(1.8)
            enhancer = ImageEnhance.Sharpness(processed)
            processed = enhancer.enhance(2.0)

        elif variant == "high_contrast":
            processed = processed.convert('L')
            enhancer = ImageEnhance.Contrast(processed)
            processed = enhancer.enhance(3.0)
            enhancer = ImageEnhance.Sharpness(processed)
            processed = enhancer.enhance(2.5)
            processed = processed.filter(ImageFilter.MedianFilter(size=3))

        elif variant == "binarized":
            processed = processed.convert('L')
            # Use int16 to prevent uint8 underflow during arithmetic
            img_array = np.array(processed, dtype=np.int16)
            blurred = processed.filter(ImageFilter.BoxBlur(15))
            blurred_array = np.array(blurred, dtype=np.int16)
            offset = 10
            binary = np.where(img_array < (blurred_array - offset), 0, 255).astype(np.uint8)
            processed = Image.fromarray(binary, mode='L')

        elif variant == "large_text":
            processed = processed.convert('L')
            enhancer = ImageEnhance.Contrast(processed)
            processed = enhancer.enhance(1.3)

        elif variant == "small_text":
            # Only upscale if the image isn't already large (prevent memory explosion)
            w, h = processed.size
            if w < 2000 and h < 2000:
                processed = processed.resize(
                    (processed.width * 2, processed.height * 2),
                    Image.Resampling.LANCZOS
                )
            processed = processed.convert('L')
            enhancer = ImageEnhance.Contrast(processed)
            processed = enhancer.enhance(2.0)
            enhancer = ImageEnhance.Sharpness(processed)
            processed = enhancer.enhance(3.0)

        elif variant == "inverted":
            processed = processed.convert('L')
            img_array = np.array(processed)
            mean_val = np.mean(img_array)
            if mean_val < 128:
                img_array = 255 - img_array
                processed = Image.fromarray(img_array, mode='L')
            enhancer = ImageEnhance.Contrast(processed)
            processed = enhancer.enhance(2.0)
            enhancer = ImageEnhance.Sharpness(processed)
            processed = enhancer.enhance(2.0)

        return processed.convert('RGB')

    except Exception as e:
        print(f"DEBUG: Preprocessing variant '{variant}' failed: {e}")
        return img.copy().convert('RGB')


def _adaptive_resize(img):
    """
    Adaptively resize the image based on its dimensions.
    Caps the maximum output to avoid memory issues.
    """
    w, h = img.size
    min_dim = min(w, h)

    if min_dim < 300:
        scale = 3
    elif min_dim < 600:
        scale = 2
    elif min_dim < 1200:
        scale = 2
    else:
        scale = 1

    new_w = w * scale
    new_h = h * scale

    # Cap maximum dimensions to prevent memory issues
    max_dim = 4000
    if new_w > max_dim or new_h > max_dim:
        ratio = min(max_dim / new_w, max_dim / new_h)
        new_w = int(new_w * ratio)
        new_h = int(new_h * ratio)

    if new_w != w or new_h != h:
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    return img


def _run_ocr_pass(img, psm_mode, lang='eng'):
    """
    Run a single OCR pass with a specific PSM mode and return word-level data.
    """
    config = f'--oem 3 --psm {psm_mode}'
    try:
        data = pytesseract.image_to_data(
            img, lang=lang, config=config, output_type=Output.DICT
        )
        return data
    except Exception as e:
        print(f"DEBUG: OCR pass with PSM {psm_mode} failed: {e}")
        return None


def _merge_ocr_results(all_results, base_width, base_height):
    """
    Merge OCR results from multiple passes, deduplicating overlapping detections.
    """
    merged_words = []

    for result_data, src_width, src_height in all_results:
        if result_data is None:
            continue

        scale_x = base_width / src_width if src_width > 0 else 1
        scale_y = base_height / src_height if src_height > 0 else 1

        n_boxes = len(result_data['text'])
        for i in range(n_boxes):
            word_text = result_data['text'][i].strip()

            try:
                conf = int(result_data['conf'][i])
            except (ValueError, TypeError):
                conf = 0

            if not word_text or conf < 20:
                continue

            x = int(result_data['left'][i] * scale_x)
            y = int(result_data['top'][i] * scale_y)
            w = max(int(result_data['width'][i] * scale_x), 1)
            h = max(int(result_data['height'][i] * scale_y), 1)

            # Check for duplicates using spatial overlap
            is_duplicate = False
            for j, existing in enumerate(merged_words):
                ex, ey, ew, eh = existing[2], existing[3], existing[4], existing[5]
                existing_conf = existing[1]

                ix1 = max(x, ex)
                iy1 = max(y, ey)
                ix2 = min(x + w, ex + ew)
                iy2 = min(y + h, ey + eh)

                if ix2 > ix1 and iy2 > iy1:
                    intersection = (ix2 - ix1) * (iy2 - iy1)
                    area1 = w * h
                    area2 = ew * eh
                    min_area = min(area1, area2)
                    overlap_ratio = intersection / min_area if min_area > 0 else 0

                    if overlap_ratio > 0.5:
                        is_duplicate = True
                        if conf > existing_conf:
                            merged_words[j] = (word_text, conf, x, y, w, h)
                        break

            if not is_duplicate:
                merged_words.append((word_text, conf, x, y, w, h))

    return merged_words


def _filter_garbage(text):
    """
    Filter out garbage OCR artifacts.
    """
    if not text:
        return False
    if len(text) == 1 and text.lower() not in ['a', 'i', '&', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']:
        return False
    alpha_count = sum(1 for c in text if c.isalnum())
    if len(text) > 2 and alpha_count / len(text) < 0.3:
        return False
    return True


def extract_text(image_path: str):
    """
    Extracts text using a multi-pass, multi-preprocessing OCR pipeline.
    Handles various font styles, sizes (big, small, medium), and font families.
    Returns: (text, highlighted_image_obj)
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    try:
        with Image.open(image_path) as img:
            img = img.convert('RGB')
            original_img = img.copy()
            base_width, base_height = img.size

            # Step 1: Adaptive resize
            resized = _adaptive_resize(img)

            # Step 2: Run OCR with strategic preprocessing + PSM combinations
            # Use fewer but more impactful combinations to avoid timeouts
            ocr_strategies = [
                # (variant, psm) — most impactful combinations
                ("default", 3),       # General purpose
                ("default", 6),       # Uniform text block
                ("high_contrast", 3), # Faint text
                ("binarized", 3),     # Mixed font sizes
                ("binarized", 6),     # Mixed fonts + block mode
                ("large_text", 3),    # Big bold fonts
                ("small_text", 6),    # Tiny text
                ("inverted", 3),      # Light on dark
                ("default", 11),      # Sparse text detection
                ("high_contrast", 11),# Sparse + faint
            ]

            all_results = []
            preprocessing_cache = {}

            for variant, psm in ocr_strategies:
                try:
                    # Cache preprocessed images to avoid recomputing
                    if variant not in preprocessing_cache:
                        preprocessed = _preprocess_variant(resized, variant)
                        preprocessing_cache[variant] = preprocessed
                    else:
                        preprocessed = preprocessing_cache[variant]

                    pw, ph = preprocessed.size
                    data = _run_ocr_pass(preprocessed, psm)
                    if data:
                        all_results.append((data, pw, ph))
                except Exception as e:
                    print(f"DEBUG: Strategy ({variant}, PSM {psm}) failed: {e}")
                    continue

            # Free cache
            preprocessing_cache.clear()

            # Step 3: Merge and deduplicate results
            merged = _merge_ocr_results(all_results, base_width, base_height)

            # Step 4: Sort words by reading order (top-to-bottom, left-to-right)
            if merged:
                merged.sort(key=lambda w: (w[3], w[2]))

                lines = []
                current_line = [merged[0]]
                for word in merged[1:]:
                    prev_word = current_line[-1]
                    prev_y_center = prev_word[3] + prev_word[5] / 2
                    curr_y_center = word[3] + word[5] / 2
                    line_height = max(prev_word[5], word[5])
                    threshold = line_height * 0.5 if line_height > 0 else 15

                    if abs(curr_y_center - prev_y_center) < threshold:
                        current_line.append(word)
                    else:
                        lines.append(current_line)
                        current_line = [word]
                lines.append(current_line)

                ordered_words = []
                for line in lines:
                    line.sort(key=lambda w: w[2])
                    ordered_words.extend(line)
            else:
                ordered_words = []

            # Step 5: Filter garbage and build final text
            text_parts = []
            for word_data in ordered_words:
                word_text = word_data[0]
                if _filter_garbage(word_text):
                    text_parts.append(word_text)

            full_text = " ".join(text_parts)

            # Step 6: Draw highlighting on the ORIGINAL image
            highlight_img = original_img.copy()
            draw = ImageDraw.Draw(highlight_img)

            for word_data in ordered_words:
                word_text = word_data[0]
                conf = word_data[1]
                x, y, w, h = word_data[2], word_data[3], word_data[4], word_data[5]
                if _filter_garbage(word_text):
                    if conf > 70:
                        color = "green"
                    elif conf > 40:
                        color = "orange"
                    else:
                        color = "red"
                    draw.rectangle([(x, y), (x + w, y + h)], outline=color, width=3)

            print(f"DEBUG: Multi-pass OCR extracted {len(text_parts)} words from {len(all_results)} OCR passes")
            return full_text, highlight_img

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"OCR failed: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        text, img = extract_text(sys.argv[1])
        print(f"Extracted text: {text}")
        print(f"Word count: {len(text.split())}")
    else:
        print("Usage: python ocr_engine.py <image_path>")
