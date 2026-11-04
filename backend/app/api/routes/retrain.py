from fastapi import APIRouter, HTTPException
from backend.app.schemas.api import RetrainRequest, RetrainStatusResponse
from backend.app.services.retrain_service import get_job_status, retrain_service

router = APIRouter()


@router.post("/retrain")
def trigger_retrain(req: RetrainRequest):
    try:
        res = retrain_service.trigger_retrain(ticker=req.ticker, force=bool(req.force))
        return res
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrain execution error: {e}")


@router.get("/retrain/status/{job_id}", response_model=RetrainStatusResponse)
def get_status(job_id: str):
    info = get_job_status(job_id)
    if not info:
        raise HTTPException(status_code=404, detail="Job not found")
    return RetrainStatusResponse(
        job_id=info["job_id"],
        ticker=info["ticker"],
        stage=info["stage"],
        progress_fold=info.get("progress_fold"),
        total_folds=info.get("total_folds"),
        diff=info.get("diff"),
        error=info.get("error"),
    )

