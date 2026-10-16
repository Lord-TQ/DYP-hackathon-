"""
Data for the 3D / linked-slice viewer and the report.

All viewer arrays are reoriented to the closest canonical RAS voxel order (axis 0 -> patient Right,
axis 1 -> Anterior, axis 2 -> Superior) so orientation labels are fixed. `canonical_affine` maps those
voxel indices to world millimetres; `original_affine` is the uploaded affine, so the client can convert
a canonical index back to the uploaded voxel index: ijk_orig = inv(original_affine) @ canonical_affine @ ijk.
"""

import base64
import json
from pathlib import Path
from typing import Any, Dict, Optional

import nibabel as nib
import numpy as np
from nibabel.orientations import apply_orientation, inv_ornt_aff, io_orientation
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes

import app.core.paths  # noqa: F401
from app.core.exceptions import NIfTIValidationError
from app.services.study_store import ValidatedStudy, study_store

from brainseg.constants import DISCLAIMER, LABEL_NAMES, MODEL_INFO, PREPROCESSING, REGIONS
from brainseg.inference import UNCERTAINTY_FILENAME
from brainseg.labels import region_masks, region_volumes

SEQUENCE_KEYS = {"t1": "T1", "t1gd": "T1Gd", "t2": "T2", "flair": "FLAIR"}
EXPERT_FILENAME = "expert.nii.gz"
PREDICTION_FILENAME = "prediction.nii.gz"
CACHE_DIR = "viewer_cache"

MESH_STYLE = {
    "brain": {"label": "Brain surface", "color": "#d8d0c0", "opacity": 0.18},
    "NCR": {"label": "NCR (1) necrotic core", "color": "#d6452c", "opacity": 0.95},
    "ED": {"label": "ED (2) oedema", "color": "#78a870", "opacity": 0.45},
    "ET": {"label": "ET (4) enhancing", "color": "#e8b030", "opacity": 0.9},
}
LABEL_CODES = {"NCR": 1, "ED": 2, "ET": 4}


# ---------------------------------------------------------------- geometry

def _ref_image(study: ValidatedStudy) -> nib.Nifti1Image:
    return nib.load(study.modalities["T1Gd"]["path"], mmap=False)


def _canonical(study: ValidatedStudy):
    ref = _ref_image(study)
    ornt = io_orientation(ref.affine)
    canon_affine = ref.affine @ inv_ornt_aff(ornt, ref.shape[:3])
    return ref, ornt, canon_affine


def _reorient(arr: np.ndarray, ornt) -> np.ndarray:
    return np.ascontiguousarray(apply_orientation(arr, ornt))


def _cache(study: ValidatedStudy) -> Path:
    d = Path(study.study_dir) / CACHE_DIR
    d.mkdir(exist_ok=True)
    return d


def _labels(study: ValidatedStudy, which: str) -> Optional[np.ndarray]:
    path = Path(study.study_dir) / (PREDICTION_FILENAME if which == "pred" else EXPERT_FILENAME)
    if not path.exists():
        return None
    return np.asarray(nib.load(str(path), mmap=False).dataobj).astype(np.uint8)


# ---------------------------------------------------------------- expert mask

def validate_expert_mask(path: Path, ref: nib.Nifti1Image) -> np.ndarray:
    """Expert masks must be readable 3D maps on the study grid with BraTS codes 0/1/2/4 only."""
    try:
        img = nib.load(str(path), mmap=False)
        data = np.asarray(img.dataobj)
    except Exception as e:  # noqa: BLE001
        raise NIfTIValidationError(f"Expert mask is not a readable NIfTI file: {e}", "INVALID_EXPERT_MASK")
    if data.ndim == 4 and data.shape[3] == 1:
        data = data[..., 0]
    if data.ndim != 3:
        raise NIfTIValidationError(f"Expert mask must be 3D, got shape {data.shape}.", "INVALID_EXPERT_MASK")
    if data.shape != ref.shape[:3]:
        raise NIfTIValidationError(
            f"Expert mask shape {data.shape} does not match the MRI sequences {ref.shape[:3]}.",
            "EXPERT_MASK_SHAPE_MISMATCH",
        )
    if not np.allclose(img.affine, ref.affine, rtol=1e-3, atol=1e-3):
        raise NIfTIValidationError("Expert mask affine does not match the MRI sequences.", "EXPERT_MASK_AFFINE_MISMATCH")
    if not np.all(np.isfinite(data)) or not np.allclose(data, np.round(data)):
        raise NIfTIValidationError("Expert mask must contain integer label codes.", "INVALID_EXPERT_MASK")
    values = set(np.unique(data).astype(int).tolist())
    if not values <= {0, 1, 2, 4}:
        hint = ""
        if 3 in values and 4 not in values:
            hint = (" It looks like Medical Segmentation Decathlon coding (1 oedema, 2 non-enhancing, 3 enhancing);"
                    " convert it with scripts/convert_expert_labels.py first.")
        raise NIfTIValidationError(
            f"Expert mask contains codes {sorted(values)}; only BraTS codes 0, 1 (NCR), 2 (ED), 4 (ET) are accepted.{hint}",
            "INVALID_EXPERT_LABELS",
            details={"values": sorted(values)},
        )
    return data.astype(np.uint8)


def store_expert_mask(study: ValidatedStudy, upload_path: Path):
    ref = _ref_image(study)
    data = validate_expert_mask(upload_path, ref)
    header = ref.header.copy()
    header.set_data_dtype(np.uint8)
    header.set_slope_inter(1, 0)
    nib.save(nib.Nifti1Image(data, ref.affine, header), str(Path(study.study_dir) / EXPERT_FILENAME))
    for f in _cache(study).glob("*"):
        if f.name.startswith(("expert", "meshes")):
            f.unlink()
    study.metadata["expert_mask"] = {"filename": upload_path.name.split("_", 1)[-1]}
    study_store.persist(study)


# ---------------------------------------------------------------- volumes for slices

def volume_bytes(study: ValidatedStudy, name: str) -> bytes:
    """uint8 voxels in canonical RAS order, x fastest (index = x + X*(y + Y*z))."""
    cache = _cache(study) / f"{name}.u8"
    if cache.exists():
        return cache.read_bytes()
    _, ornt, _ = _canonical(study)
    if name in SEQUENCE_KEYS:
        data = np.asarray(nib.load(study.modalities[SEQUENCE_KEYS[name]]["path"], mmap=False).dataobj, dtype=np.float32)
        nz = data[data != 0]
        lo, hi = (np.percentile(nz, [0.5, 99.5]) if nz.size else (0.0, 1.0))
        scaled = np.clip((data - lo) / max(hi - lo, 1e-6), 0, 1) * 255
        scaled[data == 0] = 0
        arr = scaled.astype(np.uint8)
    elif name == "uncert":
        path = Path(study.study_dir) / UNCERTAINTY_FILENAME
        if not path.exists():
            raise NIfTIValidationError("No uncertainty map for this study.", "NOT_AVAILABLE", status_code=404)
        arr = np.asarray(nib.load(str(path), mmap=False).dataobj).astype(np.uint8)
    elif name in ("pred", "expert"):
        arr = _labels(study, name)
        if arr is None:
            raise NIfTIValidationError(f"No {name} label map for this study.", "NOT_AVAILABLE", status_code=404)
    else:
        raise NIfTIValidationError(f"Unknown volume '{name}'.", "NOT_AVAILABLE", status_code=404)
    out = _reorient(arr, ornt).tobytes(order="F")
    cache.write_bytes(out)
    return out


# ---------------------------------------------------------------- meshes

def _mesh(mask: np.ndarray, canon_affine: np.ndarray, sigma: float, step: int) -> Optional[Dict[str, str]]:
    if mask.sum() < 8:
        return None
    field = gaussian_filter(np.pad(mask.astype(np.float32), 2), sigma)
    if field.max() < 0.5:
        return None
    verts, faces, _, _ = marching_cubes(field, level=0.5, step_size=step, allow_degenerate=False)
    verts -= 2  # undo padding
    world = (np.c_[verts, np.ones(len(verts))] @ canon_affine.T)[:, :3].astype(np.float32)
    return {
        "vertices": base64.b64encode(world.tobytes()).decode(),
        "faces": base64.b64encode(faces.astype(np.uint32).tobytes()).decode(),
        "n_vertices": int(len(world)),
        "n_faces": int(len(faces)),
    }


def meshes(study: ValidatedStudy) -> Dict[str, Any]:
    cache = _cache(study) / "meshes.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    _, ornt, canon_affine = _canonical(study)
    seqs = [np.asarray(nib.load(study.modalities[m]["path"], mmap=False).dataobj) != 0 for m in SEQUENCE_KEYS.values()]
    brain = _reorient(np.logical_or.reduce(seqs).astype(np.uint8), ornt)
    out = {"brain": {**MESH_STYLE["brain"], "source": "brain", **(_mesh(brain, canon_affine, 1.5, 2) or {})}}
    for source in ("pred", "expert"):
        lab = _labels(study, source)
        if lab is None:
            continue
        lab = _reorient(lab, ornt)
        for name, code in LABEL_CODES.items():
            m = _mesh(lab == code, canon_affine, 0.6, 1)
            if m:
                style = dict(MESH_STYLE[name])
                if source == "expert":
                    style["label"] = "Expert " + style["label"]
                    style["opacity"] = 0.35
                out[f"{source}_{name}"] = {**style, "source": source, "code": code, **m}
    cache.write_text(json.dumps(out), encoding="utf-8")
    return out


# ---------------------------------------------------------------- metrics + meta

def _agreement(pred: np.ndarray, expert: np.ndarray, spacing) -> Dict[str, Any]:
    from brainseg.metrics import case_metrics
    return case_metrics(pred, expert, spacing)


def meta(study: ValidatedStudy) -> Dict[str, Any]:
    ref, ornt, canon_affine = _canonical(study)
    canon_shape = [0, 0, 0]
    for in_axis, (out_axis, _) in enumerate(ornt):
        canon_shape[int(out_axis)] = int(ref.shape[in_axis])
    spacing = [float(z) for z in ref.header.get_zooms()[:3]]
    canon_spacing = [float(np.linalg.norm(canon_affine[:3, i])) for i in range(3)]
    pred, expert = _labels(study, "pred"), _labels(study, "expert")
    record = study.metadata.get("prediction", {})
    result: Dict[str, Any] = {
        "study_id": study.study_id,
        "created_at": study.created_at,
        "expires_at": study.expires_at,
        "canonical_shape": canon_shape,
        "canonical_affine": canon_affine.tolist(),
        "canonical_spacing_mm": canon_spacing,
        "original_shape": [int(s) for s in ref.shape[:3]],
        "original_affine": ref.affine.tolist(),
        "original_orientation": "".join(nib.aff2axcodes(ref.affine)),
        "spacing_mm": spacing,
        "voxel_volume_mm3": float(np.prod(spacing)),
        "sequences": {k: study.modalities[v]["filename"] for k, v in SEQUENCE_KEYS.items()},
        "label_names": {str(k): v for k, v in LABEL_NAMES.items()},
        "regions": {k: list(v) for k, v in REGIONS.items()},
        "has_prediction": pred is not None,
        "has_expert": expert is not None,
        "volumes": {"model": region_volumes(pred, spacing) if pred is not None else None,
                    "expert": region_volumes(expert, spacing) if expert is not None else None},
        "agreement": _agreement(pred, expert, spacing) if pred is not None and expert is not None else None,
        "suitability": study.metadata.get("suitability", {}),
        "backup": study.metadata.get("backup"),
        "source_4d": study.metadata.get("source_4d"),
        "uncertainty": record.get("uncertainty"),
        "has_uncertainty": (Path(study.study_dir) / UNCERTAINTY_FILENAME).exists(),
        "ablation": study.metadata.get("ablation"),
        "provenance": record.get("provenance"),
        "model": MODEL_INFO,
        "preprocessing": PREPROCESSING,
        "disclaimer": DISCLAIMER,
    }
    if pred is not None and pred.any():
        c = np.argwhere(_reorient(pred, ornt) > 0).mean(axis=0)
        result["lesion_centroid_canonical"] = [int(round(v)) for v in c]
    return result


def get_study(study_id: str) -> ValidatedStudy:
    return study_store.get_validated_study(study_id)
