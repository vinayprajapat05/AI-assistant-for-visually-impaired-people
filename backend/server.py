from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import os
import uuid
from ocr_engine import extract_text
from text_cleaner import clean_text
from summarizer import summarize

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_uploads"
os.makedirs(TEMP_DIR, exist_ok=True)

import io
import base64


@app.post("/process-image")
async def process_image(file: UploadFile = File(...)):
    try:
        file_ext = file.filename.split(".")[-1]
        temp_filename = f"{uuid.uuid4()}.{file_ext}"
        temp_path = os.path.join(TEMP_DIR, temp_filename)
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        try:
            print(f"DEBUG: Processing file {temp_path}, Size: {os.path.getsize(temp_path)} bytes")
            raw_text, highlighted_img = extract_text(temp_path)
            print(f"DEBUG: OCR Raw Text: '{raw_text}'")
            print(f"DEBUG: Text Length: {len(raw_text.strip())}")
        except Exception as e:
            print(f"DEBUG: OCR Exception: {e}")
            raise HTTPException(status_code=500, detail=f"OCR Error: {str(e)}")
        
        cleaned_text = clean_text(raw_text)
        summary_result = summarize(cleaned_text)
        buffered = io.BytesIO()
        highlighted_img.save(buffered, format="JPEG")
        encoded_string = base64.b64encode(buffered.getvalue()).decode('utf-8')

        return {
            "range_status": "in_range",
            "summary": summary_result.get("summary", "Could not generate summary."),
            "image_base64": f"data:image/jpeg;base64,{encoded_string}"
        }

    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="https://vfht3x3v-8000.inc1.devtunnels.ms/")
    # uvicorn.run(app, host="0.0.0.0", port=8000)

