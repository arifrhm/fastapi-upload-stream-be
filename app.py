from fastapi import FastAPI, Request, Header
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
import aiofiles
import os

app = FastAPI()
templates = Jinja2Templates(directory="templates")

# Mount the static files directory to serve CSS and JS files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Add GZip middleware
app.add_middleware(
    GZipMiddleware,
    minimum_size=1000  # Minimum size of response (in bytes) to compress
)


@app.get("/", response_class=HTMLResponse)
async def main_page(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )


@app.post("/upload-octet/")
async def upload_octet(
    request: Request,
    x_file_name: str = Header(...),
    x_file_offset: int = Header(...)
):
    file_path = os.path.join("uploads", x_file_name)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    async with aiofiles.open(file_path, "ab") as f:
        await f.seek(x_file_offset)
        chunk = await request.body()
        await f.write(chunk)

    return {
        "status": "Chunk uploaded !!",
        "filename": x_file_name,
        "offset": os.path.getsize(file_path),
    }


@app.get("/upload-status/")
async def upload_status(filename: str):
    file_path = os.path.join("uploads", filename)
    if os.path.exists(file_path):
        return {
            "status": "In progress",
            "uploaded_bytes": os.path.getsize(file_path)
        }
    return {"status": "Not found", "uploaded_bytes": 0}
