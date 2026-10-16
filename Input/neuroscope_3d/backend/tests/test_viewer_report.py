"""Viewer data, expert mask, suitability refusal and report endpoints (synthetic phantom; plumbing only)."""

import gzip

import nibabel as nib
import numpy as np
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.segmentation_engine import segmentation_pipeline
from app.services.study_store import study_store
from tests.test_upload_to_prediction import lps_aniso_affine, phantom

ready, missing = segmentation_pipeline.check_dependencies()


def _nifti_bytes(arr, affine):
    return nib.Nifti1Image(arr, affine).to_bytes()


def _upload(client, data, extra=None):
    files = [
        ("t1", ("Case01_t1.nii", data["t1"], "application/octet-stream")),
        ("t1gd", ("Case01_t1ce.nii", data["t1ce"], "application/octet-stream")),
        ("t2", ("Case01_t2.nii", data["t2"], "application/octet-stream")),
        ("flair", ("Case01_flair.nii", data["flair"], "application/octet-stream")),
    ] + (extra or [])
    return client.post("/api/upload/validate", files=files)


def test_not_skull_stripped_input_is_refused():
    client = TestClient(app)
    rng = np.random.default_rng(1)
    noisy = {k: _nifti_bytes((rng.random((96, 96, 64)) * 100 + 1).astype(np.float32), np.eye(4))
             for k in ("t1", "t1ce", "t2", "flair")}
    res = _upload(client, noisy)
    assert res.status_code == 422
    assert res.json()["error_code"] == "UNSUITABLE_INPUT"
    assert "skull" in res.json()["message"]


def test_expert_mask_with_decathlon_codes_is_rejected():
    client = TestClient(app)
    shape, aff = (96, 96, 64), np.eye(4)
    bad = np.zeros(shape, np.uint8); bad[40:50, 40:50, 30:40] = 3
    res = _upload(client, phantom(shape, aff), [("expert", ("mask.nii", _nifti_bytes(bad, aff), "application/octet-stream"))])
    assert res.status_code == 400
    assert res.json()["error_code"] == "INVALID_EXPERT_LABELS"
    assert "Decathlon" in res.json()["message"]


@pytest.mark.skipif(not ready, reason=f"inference unavailable: {missing}")
def test_viewer_and_report_with_expert_mask():
    client = TestClient(app)
    study_store.clear()
    shape, aff = (160, 192, 96), lps_aniso_affine()
    expert = np.zeros(shape, np.uint8)
    g = np.meshgrid(*[np.linspace(-1, 1, n) for n in shape], indexing="ij")
    r = np.sqrt((g[0] - 0.3) ** 2 + (g[1] - 0.1) ** 2 + g[2] ** 2)
    expert[r < 0.35] = 2; expert[r < 0.2] = 4; expert[r < 0.12] = 1
    try:
        up = _upload(client, phantom(shape, aff),
                     [("expert", ("Case01_seg.nii", _nifti_bytes(expert, aff), "application/octet-stream"))])
        assert up.status_code == 200, up.json()
        sid = up.json()["study_id"]
        assert up.json()["expert_mask"] is True
        assert client.post("/api/segmentation/run", json={"study_id": sid}).status_code == 200

        meta = client.get(f"/api/viewer/{sid}/meta").json()
        X, Y, Z = meta["canonical_shape"]
        assert sorted(meta["canonical_shape"]) == sorted(shape)
        assert meta["has_prediction"] and meta["has_expert"]
        assert set(meta["agreement"]) == {"WT", "TC", "ET"}
        assert meta["volumes"]["expert"]["WT"]["voxels"] == int((expert > 0).sum())
        # canonical axes point R, A, S
        A = np.array(meta["canonical_affine"])
        assert A[0, 0] > 0 and A[1, 1] > 0 and A[2, 2] > 0

        for name in ("flair", "pred", "expert"):
            vol = client.get(f"/api/viewer/{sid}/volume/{name}")
            assert vol.status_code == 200 and len(vol.content) == X * Y * Z
        # expert volume in canonical order matches the uploaded mask reoriented
        exp_canon = np.frombuffer(client.get(f"/api/viewer/{sid}/volume/expert").content, np.uint8).reshape((X, Y, Z), order="F")
        assert np.array_equal(exp_canon, nib.as_closest_canonical(nib.Nifti1Image(expert, aff)).get_fdata().astype(np.uint8))

        meshes = client.get(f"/api/viewer/{sid}/meshes").json()
        assert "brain" in meshes and meshes["brain"]["n_faces"] > 0
        assert any(k.startswith("expert_") for k in meshes)
        verts = np.frombuffer(__import__("base64").b64decode(meshes["brain"]["vertices"]), np.float32).reshape(-1, 3)
        world_corners = np.array([aff @ [i, j, k, 1] for i in (0, shape[0]) for j in (0, shape[1]) for k in (0, shape[2])])[:, :3]
        assert (verts.min(0) >= world_corners.min(0) - 3).all() and (verts.max(0) <= world_corners.max(0) + 3).all()

        page = client.get(f"/report/{sid}")
        assert page.status_code == 200
        for text in ("Not a diagnosis", "SHA-256", "Formula", "Provenance", "Limitations", "Agreement"):
            assert text in page.text
        pdf = client.get(f"/api/report/{sid}.pdf")
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
        assert client.get(f"/viewer/{sid}").status_code == 200
    finally:
        study_store.clear()
