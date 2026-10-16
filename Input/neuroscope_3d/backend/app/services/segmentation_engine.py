"""
MONAI SegResNet Brain MRI Segmentation Engine for NeuroScope 3D.
Processes validated BraTS 2021 multi-parametric MRI sequences in protocol order:
[T1Gd, T1, T2, FLAIR].
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import nibabel as nib
import numpy as np

from app.core.exceptions import NIfTIValidationError
from app.models.schemas import (
    SegmentationRunResponse,
    TumorSubRegionMetrics,
)
from app.services.study_store import ValidatedStudy, study_store

DEFAULT_WEIGHTS_PATH = Path(__file__).resolve().parent.parent / "models" / "weights" / "segresnet_brats21.pt"
PROTOCOL_CHANNEL_ORDER = ["T1Gd", "T1", "T2", "FLAIR"]


class SegmentationEngine:
    """
    Executes 3D brain tumor segmentation on validated MRI studies.
    Strictly verifies study registration and checks segmentation dependencies.
    """

    def __init__(self, weights_path: Optional[Path] = None):
        self.weights_path = Path(
            os.environ.get("NEUROSCOPE_MODEL_WEIGHTS", str(weights_path or DEFAULT_WEIGHTS_PATH))
        )

    def check_dependencies(self) -> Tuple[bool, List[str]]:
        """
        Check for required inference dependencies and pre-trained model weights.
        Returns (is_ready, list_of_missing_components).
        """
        missing = []
        try:
            import torch
        except ImportError:
            missing.append("PyTorch (torch)")

        try:
            import monai
        except ImportError:
            missing.append("MONAI (monai)")

        if not self.weights_path.exists():
            missing.append(f"Model weights ({self.weights_path.name} at {self.weights_path})")

        return (len(missing) == 0), missing

    def run_segmentation(self, study_id: str) -> Dict[str, Any]:
        """
        Execute segmentation pipeline on a validated study.
        1. Verifies study exists, is validated, and is unexpired via study_store.
        2. Verifies presence of all 4 required sequences.
        3. Loads channels in protocol order [T1Gd, T1, T2, FLAIR].
        4. Reports exact missing components if dependencies/weights are not installed.
        """
        # 1. Verification of study
        study = study_store.get_validated_study(study_id)
        if not study.validated:
            raise NIfTIValidationError(
                message=f"Study '{study_id}' has not passed validation and cannot be segmented.",
                error_code="UNVALIDATED_STUDY",
                status_code=400,
            )

        # 2. Modality presence verification
        for mod in PROTOCOL_CHANNEL_ORDER:
            if mod not in study.modalities or study.modalities[mod].get("status") != "valid":
                raise NIfTIValidationError(
                    message=f"Study is missing valid sequence for modality '{mod}'.",
                    error_code="INCOMPLETE_STUDY",
                    status_code=400,
                )

        # 3. Check dependencies & weights
        is_ready, missing = self.check_dependencies()
        if not is_ready:
            missing_str = ", ".join(missing)
            raise RuntimeError(
                f"Segmentation dependencies or model weights are unavailable. "
                f"Missing components: {missing_str}. "
                f"Upload and validation succeeded, but inference requires these dependencies."
            )

        # 4. If dependencies are present, execute full MONAI SegResNet pipeline
        import torch
        from monai.networks.nets import SegResNet

        # Load 4-channel tensor in strict protocol order: [T1Gd, T1, T2, FLAIR]
        channels = []
        for mod in PROTOCOL_CHANNEL_ORDER:
            fpath = study.modalities[mod]["path"]
            img = nib.load(fpath)
            data = img.get_fdata().astype(np.float32)
            # Intensity normalization (z-score on non-zero brain mask)
            mask = data > 0
            if np.any(mask):
                data[mask] = (data[mask] - np.mean(data[mask])) / (np.std(data[mask]) + 1e-5)
            channels.append(data)

        volume_tensor = torch.from_numpy(np.stack(channels, axis=0)).unsqueeze(0)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = SegResNet(
            spatial_dims=3,
            in_channels=4,
            out_channels=3,
            init_filters=16,
            blocks_down=[1, 2, 2, 4],
            blocks_up=[1, 1, 1],
            dropout_prob=0.2,
        )
        model.load_state_dict(torch.load(self.weights_path, map_location=device))
        model.to(device)
        model.eval()

        with torch.no_grad():
            preds = model(volume_tensor.to(device))
            probs = torch.sigmoid(preds).cpu().numpy()[0]

        zooms = study.metadata.get("voxel_spacing_mm", [1.0, 1.0, 1.0])
        voxel_vol_cm3 = float(np.prod(zooms[:3])) / 1000.0

        wt_mask = probs[0] > 0.5
        tc_mask = probs[1] > 0.5
        et_mask = probs[2] > 0.5

        wt_voxels = int(np.sum(wt_mask))
        tc_voxels = int(np.sum(tc_mask))
        et_voxels = int(np.sum(et_mask))

        return {
            "status": "success",
            "study_id": study_id,
            "message": "3D Brain MRI tumor segmentation completed successfully.",
            "model": "MONAI SegResNet (BraTS 2021 pre-trained)",
            "input_channel_order": PROTOCOL_CHANNEL_ORDER,
            "sub_regions": {
                "whole_tumor": {
                    "label": "Whole Tumor (WT)",
                    "volume_cm3": round(wt_voxels * voxel_vol_cm3, 2),
                    "voxel_count": wt_voxels,
                },
                "tumor_core": {
                    "label": "Tumor Core (TC)",
                    "volume_cm3": round(tc_voxels * voxel_vol_cm3, 2),
                    "voxel_count": tc_voxels,
                },
                "enhancing_tumor": {
                    "label": "Enhancing Tumor (ET)",
                    "volume_cm3": round(et_voxels * voxel_vol_cm3, 2),
                    "voxel_count": et_voxels,
                },
            },
            "whole_tumor_volume_cm3": round(wt_voxels * voxel_vol_cm3, 2),
            "tumor_core_volume_cm3": round(tc_voxels * voxel_vol_cm3, 2),
            "enhancing_tumor_volume_cm3": round(et_voxels * voxel_vol_cm3, 2),
            "status_code": 200,
        }


# Global singleton pipeline
segmentation_pipeline = SegmentationEngine()
