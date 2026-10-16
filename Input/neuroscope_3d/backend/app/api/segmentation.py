"""
Segmentation API endpoints for NeuroScope 3D.
Receives validated study requests and runs MONAI SegResNet 3D pipeline.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.exceptions import NIfTIValidationError, StudyNotFoundError
from app.models.schemas import SegmentationRunRequest, SegmentationRunResponse
from app.services.segmentation_engine import segmentation_pipeline
from app.services.study_store import study_store

router = APIRouter(prefix="/api/segmentation", tags=["Segmentation Pipeline"])


@router.post(
    "/run",
    response_model=SegmentationRunResponse,
    summary="Run MONAI SegResNet brain tumor segmentation on validated MRI study",
)
async def run_segmentation_endpoint(request: SegmentationRunRequest):
    """
    Triggers segmentation inference.
    Strictly verifies on the server that study_id corresponds to a valid, unexpired study.
    Rejects invalid, missing, or expired studies.
    """
    study_id = request.study_id
    try:
        # Independent validation check
        result = segmentation_pipeline.run_segmentation(study_id)
        return result
    except NIfTIValidationError as e:
        return JSONResponse(status_code=e.status_code, content=e.to_dict())
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Segmentation pipeline failed: {str(e)}",
                "study_id": study_id,
            },
        )


@router.get(
    "/study/{study_id}",
    summary="Retrieve validation status and metadata for a study",
)
async def get_study_status(study_id: str):
    """Check if a study is registered and ready for segmentation."""
    try:
        study = study_store.get_validated_study(study_id)
        return {
            "status": "success",
            "study_id": study.study_id,
            "validated": study.validated,
            "created_at": study.created_at,
            "expires_at": study.expires_at,
            "metadata": study.metadata,
            "modalities": {
                k: {"status": v["status"], "filename": v["filename"], "shape": v["shape"]}
                for k, v in study.modalities.items()
            },
        }
    except NIfTIValidationError as e:
        return JSONResponse(status_code=e.status_code, content=e.to_dict())
