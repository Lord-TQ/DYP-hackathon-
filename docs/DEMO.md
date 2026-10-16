# 5-minute demo script + viva prep

**Before the slot:** `python run.py` running; browser open at http://localhost:8000/; `demo_cases/BRATS_002/` (or the
judges' case) ready in a file explorer; a terminal in the repo root. Backup ready: http://localhost:8000/backup.

| Time | Show | Say (key points) |
|---|---|---|
| 0:00–0:30 | Upload page, red disclaimer | "Research and teaching prototype. It shows *suspected tumour regions predicted by the model* and *estimated volumes* — never a diagnosis." |
| 0:30–1:15 | Drop four files; slots turn green; *Validate* | Sequences recognised from filenames (t1/t1ce/t2/flair) or by selection; checks: readable, 3D, finite, non-constant, ≤ 1 GB, same shape + affine, skull-stripped heuristic. Upload is deleted within 24 h. |
| 1:15–1:45 | *Proceed* → volumes card | Pretrained MONAI SegResNet (v0.5.4, Apache-2.0), ~5–10 s on GPU. Output is a NIfTI on the input grid, codes 1 NCR / 2 ED / 4 ET. |
| 1:45–3:15 | *Open viewer* | Rotate / zoom 3D (world mm), toggle + opacity per region; click in axial → crosshair moves in coronal, sagittal and 3D; voxel indices + world mm; L/R, A/P, S/I labels (radiological view). Attach the expert mask → *Agreement — WT* overlay (green both, orange model only, blue expert only) and Dice/sensitivity/HD95 for this case. |
| 3:15–3:45 | Volumes table | V = N × Δx·Δy·Δz; mL = mm³ / 1000; values shown for every region. |
| 3:45–4:30 | *Report* → PDF | Volumes, evaluation on held-out cases with overlap disclosure, provenance (model, version, licence, preprocessing, SHA-256, commit, timestamp), limitations, disclaimer on every page. |
| 4:30–5:00 | Terminal | `python -m brainseg.predict --t1 … --out pred.nii.gz` — the judges' scorer command. Close on limitations. |

If anything fails live: say so, then open http://localhost:8000/backup — every screen is bannered
"PRECOMPUTED BACKUP CASE … NOT a live run".

## Likely viva questions

- **Why these label codes?** BraTS: 1 NCR, 2 ED, 4 ET (category IDs, not severity). The network outputs overlapping
  TC/WT/ET channels; we map ET→4, TC∖ET→1, WT∖TC→2. Decathlon labels (1 oedema, 2 non-enhancing, 3 enhancing) are
  converted 1→2, 2→1, 3→4 for evaluation.
- **How do you keep the original grid?** Reorient to RAS + resample to 1 mm with MONAI transforms that record their
  operations, infer, then invert the same transforms on the probabilities and threshold; the NIfTI is saved with the
  uploaded affine and header. Tested on flipped, anisotropic (1×1×1.5 mm) and shifted grids.
- **Is the evaluation independent?** No — disclosed. Decathlon Task01 comes from BraTS 2016/17, which overlaps the
  model's BraTS 2018 training data; we cannot identify which cases, so metrics are optimistic. We did no training.
- **What if a sequence is missing / swapped?** Missing → rejected with the missing name. Swapped sequences cannot be
  detected reliably; filenames/selection decide, and the user sees the assignment before validating.
- **Where does it fail?** Non-glioma tumours, post-operative scans, non-skull-stripped or non-co-registered inputs,
  thick slices, small ET/NCR regions.
- **Data protection?** Public de-identified data only; nothing sent to third parties; uploads auto-deleted < 24 h
  (persisted record + background sweeper, survives restarts).
