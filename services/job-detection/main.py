import logging
import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dreamcanvas-job-detection")
app = FastAPI(title="DreamCanvas Job Detection RPC")
legacy_url = os.getenv("LEGACY_ML_URL", "https://job-posting-detection-api.onrender.com/predict")


class PredictionRequest(BaseModel):
    job_description: str = Field(min_length=20, max_length=50000)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"service": "job-detection", "status": "ONLINE"}


@app.post("/predict")
async def predict(request: PredictionRequest) -> dict[str, Any]:
    logger.info("RPC prediction request received, description_length=%s", len(request.job_description))
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
            response = await client.post(legacy_url, json={"description": request.job_description})
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.exception("ML provider unavailable")
        raise HTTPException(status_code=503, detail="ML prediction service unavailable") from error
    if "prediction" not in result or "confidence" not in result:
        raise HTTPException(status_code=502, detail="ML provider returned an invalid response")
    return {"prediction": result["prediction"], "confidence": result["confidence"]}
