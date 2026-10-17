import logging
import os
import time
from typing import Any
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dreamcanvas-job-detection")
app = FastAPI(title="DreamCanvas Job Detection RPC")
legacy_url = os.getenv("LEGACY_ML_URL", "https://job-posting-detection-api.onrender.com/predict")
service_started_at = time.monotonic()


class PredictionRequest(BaseModel):
    job_description: str = Field(min_length=20, max_length=50000)


class RpcParams(BaseModel):
    description: str = Field(min_length=20, max_length=50000)


class RpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: RpcParams
    requestId: str | None = None
    id: str | int | None = None


@app.get("/health")
async def health() -> dict[str, Any]:
    started = time.perf_counter()
    return {
        "service": "AI/ML Job Detection Service",
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptimeSeconds": int(time.monotonic() - service_started_at),
        "responseTimeMs": round((time.perf_counter() - started) * 1000, 2),
        "version": "1.2.0",
    }


async def _execute_ml_prediction(description: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
            response = await client.post(legacy_url, json={"description": description})
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.exception("ML provider unavailable")
        raise HTTPException(status_code=503, detail="ML prediction service unavailable") from error

    if "prediction" not in result or "confidence" not in result:
        raise HTTPException(status_code=502, detail="ML provider returned an invalid response")

    return {
        "prediction": result["prediction"],
        "confidence": float(result["confidence"]),
    }


@app.post("/predict")
async def predict(request: PredictionRequest) -> dict[str, Any]:
    logger.info("REST prediction request received, length=%s", len(request.job_description))
    result = await _execute_ml_prediction(request.job_description)
    return {"prediction": result["prediction"], "confidence": result["confidence"]}


@app.post("/rpc/predict-job")
@app.post("/rpc")
async def rpc_predict_job(rpc_req: RpcRequest) -> dict[str, Any]:
    from datetime import datetime, timezone
    req_id = rpc_req.requestId or str(rpc_req.id or "req-001")
    logger.info(
        "RPC request received: method=%s, reqId=%s, desc_len=%s",
        rpc_req.method,
        req_id,
        len(rpc_req.params.description),
    )

    if rpc_req.method not in ("predictJob", "predict", "jobDetection"):
        raise HTTPException(
            status_code=400,
            detail={"code": -32601, "message": f"Method '{rpc_req.method}' not found"},
        )

    ml_result = await _execute_ml_prediction(rpc_req.params.description)
    pred_label = "REAL" if ml_result["prediction"] == 0 else "FAKE"

    return {
        "jsonrpc": "2.0",
        "requestId": req_id,
        "id": req_id,
        "method": rpc_req.method,
        "result": {
            "prediction": pred_label,
            "numericPrediction": ml_result["prediction"],
            "confidence": ml_result["confidence"],
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "SUCCESS",
    }
