from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from backend.app.db import get_session
from backend.app.models.tables import ModelVersion
from backend.app.repositories.model_repo import model_repo

router = APIRouter()


@router.get("/models", response_model=list[ModelVersion])
def list_models(ticker: str, session: Session = Depends(get_session)):
    return model_repo.list_for_ticker(session, ticker)


@router.get("/models/active", response_model=Optional[ModelVersion])
def get_active_model(ticker: str, session: Session = Depends(get_session)):
    m = model_repo.get_active(session, ticker)
    if not m:
        raise HTTPException(status_code=404, detail=f"No active model for {ticker}")
    return m

