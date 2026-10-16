# NeuroScope 3D — brain MRI tumour-region segmentation (research prototype)

> **Research and teaching prototype.** Outputs are *suspected tumour regions predicted by the model* and
> *estimated volumes*. Not a diagnosis; not clinically validated; not for clinical use. Use only public,
> de-identified research data. Uploads are deleted automatically within 24 hours.

Upload one MRI study (T1, T1Gd, T2, FLAIR as NIfTI), run a pretrained MONAI SegResNet, view the predicted
NCR / ED / ET regions as 3D meshes in world millimetres and in linked axial / coronal / sagittal slices, read the
estimated volumes with their formula, compare with an optional expert mask, and download a NIfTI label map and a
report (HTML / PDF).

## Quick start

```bash
# one-time setup (creates .venv, installs PyTorch + requirements, downloads the model weights)
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1      # Windows
bash scripts/setup.sh                                           # Linux / macOS

# start the platform — one command
.venv/Scripts/python run.py        # Windows   (Linux: .venv/bin/python run.py)
```

Open http://localhost:8000/ (API docs: http://localhost:8000/docs). `run.py` downloads the weights itself if missing.

## Judge checks — command and endpoints

**Command** (four files in, NIfTI label map out, on the input grid and affine, BraTS codes 1/2/4):

```bash
python -m brainseg.predict --t1 T1.nii.gz --t1gd T1Gd.nii.gz --t2 T2.nii.gz --flair FLAIR.nii.gz --out prediction.nii.gz
```

Also writes `prediction_meta.json` (volumes, provenance: model/version/licence, preprocessing, input SHA-256, code
commit, timestamp).

**Endpoint, one call**: `POST /api/segmentation/predict` (multipart fields `t1`, `t1gd`, `t2`, `flair`, optional
`expert`) → `prediction.nii.gz`; headers `X-Study-Id`, `X-Viewer-Url`, `X-Report-Url`.

```bash
curl -f -o prediction.nii.gz -D - -F t1=@T1.nii.gz -F t1gd=@T1Gd.nii.gz -F t2=@T2.nii.gz -F flair=@FLAIR.nii.gz \
     http://localhost:8000/api/segmentation/predict
```

**Step by step**: `POST /api/upload/validate` → `study_id`; `POST /api/segmentation/run {"study_id": …}` →
volumes + URLs; `GET /api/segmentation/prediction/{id}` (NIfTI); `GET /viewer/{id}`; `GET /report/{id}`;
`GET /api/report/{id}.pdf`; `POST /api/viewer/{id}/expert` (attach expert mask later).

Invalid input is rejected with a JSON `error_code` and message and never reaches the model: unreadable / not NIfTI,
not 3D, non-finite values, constant image, > 1 GiB, missing or duplicate sequence, shape or affine mismatch,
singular affine, and clearly non-skull-stripped input (`UNSUITABLE_INPUT`, HTTP 422). Borderline inputs get warnings.

## Shared interface

| Item | Value |
|---|---|
| Sequences | `t1`, `t1gd` (aliases t1ce, t1c), `t2`, `flair` — by form field, filename, or user selection |
| Network channel order | T1Gd, T1, T2, FLAIR |
| Output label map | `uint8`, same shape + affine as the input; 0 background, 1 NCR, 2 ED, 4 ET |
| Regions | WT = {1,2,4}, TC = {1,4}, ET = {4} |
| Expert mask | optional, BraTS codes 0/1/2/4 on the same grid (Decathlon 0–3 coding is rejected with a hint) |
| Volumes | V = N × Δx·Δy·Δz (header spacing) mm³; mL = mm³ / 1000 |
| Viewer arrays | reoriented to canonical RAS; coordinates shown as uploaded-grid voxel indices and world mm |

Defined once in `brainseg/constants.py`.

## Repository layout

```
run.py                         one-command start
brainseg/                      model pipeline (inference, labels, metrics, suitability checks, CLI)
models/brats_mri_segmentation  MONAI bundle configs + licence (weights downloaded, not in git)
Input/neuroscope_3d/backend    FastAPI app: upload/validation, segmentation, viewer data, reports, tests
Input/neuroscope_3d/frontend   upload page (React)
.../backend/app/static         3D + linked-slice viewer (three.js, vendored for offline use)
scripts/                       evaluate.py, prepare_demo_case.py, convert_expert_labels.py, setup scripts
evaluation/                    metrics.json, RESULTS.md, per_case.csv, split.json
docs/                          MODEL_CARD.md, sample_report.pdf / .html
```

## Evaluation

```bash
python scripts/evaluate.py --data-dir data/Task01_BrainTumour --n 20
```

Results, case list (patient-wise; one study per subject) and the training-overlap disclosure are in
`evaluation/RESULTS.md`. **The pretrained model's BraTS 2018 training data very likely overlaps the Decathlon
evaluation cases, so these numbers are optimistic.** We did not train or tune on any data, and never train on,
tune on or keep judge-provided cases.

## Tests

```bash
cd Input/neuroscope_3d/backend && ../../../.venv/Scripts/python -m pytest -q tests     # 40+ tests
```

Covers the judges' failure pack (fake / corrupt / 2D / constant / NaN / oversized / mismatched / missing files),
upload → inference → NIfTI on RAS and LPS anisotropic grids, the single-call endpoint, suitability refusal,
expert-mask validation, viewer data, and HTML/PDF reports.

## Limitations

See `docs/MODEL_CARD.md`. In short: adult pre-operative glioma training data only; needs skull-stripped,
co-registered sequences; ET/NCR least reliable; volumes are estimates of predicted regions; not clinically validated.

## Model and licence

MONAI Model Zoo `brats_mri_segmentation` v0.5.4 (SegResNet), Apache-2.0, © MONAI Consortium. Myronenko A.,
"3D MRI brain tumor segmentation using autoencoder regularization", BrainLes 2018, arXiv:1810.11654.

## Data and citations

This project uses the **Medical Segmentation Decathlon** Task01 (BrainTumour) for development and evaluation, which
is derived from **BraTS** 2016/2017; the model was trained on **BraTS 2018**.

- Antonelli M. et al. "The Medical Segmentation Decathlon." *Nature Communications* 13, 4128 (2022).
- Simpson A. L. et al. "A large annotated medical image dataset for the development and evaluation of segmentation
  algorithms." arXiv:1902.09063 (2019).
- Menze B. H. et al. "The Multimodal Brain Tumor Image Segmentation Benchmark (BRATS)." *IEEE TMI* 34(10):1993–2024 (2015).
- Bakas S. et al. "Advancing The Cancer Genome Atlas glioma MRI collections with expert segmentation labels and
  radiomic features." *Scientific Data* 4:170117 (2017).
- Bakas S. et al. "Identifying the best machine learning algorithms for brain tumor segmentation, progression
  assessment, and overall survival prediction in the BRATS challenge." arXiv:1811.02629 (2018).
- Baid U. et al. "The RSNA-ASNR-MICCAI BraTS 2021 Benchmark on Brain Tumor Segmentation and Radiogenomic
  Classification." arXiv:2107.02314 (2021) — cite if BraTS 2021 cases are used (e.g. judges' test cases).
