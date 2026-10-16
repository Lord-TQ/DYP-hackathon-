"""Per-study report (HTML page and PDF): volumes, agreement, evaluation, provenance, limitations, disclaimer."""

import base64
import datetime
import html
import io
import json
import textwrap
from pathlib import Path
from typing import Any, Dict, Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import nibabel as nib  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.colors import ListedColormap  # noqa: E402

import app.core.paths  # noqa: E402,F401
from app.core.paths import REPO_ROOT  # noqa: E402
from app.services import viewer_data as vd  # noqa: E402
from app.services.study_store import ValidatedStudy  # noqa: E402

from brainseg.constants import DISCLAIMER, LIMITATIONS, MODEL_INFO, PREPROCESSING  # noqa: E402

EVALUATION_FILE = REPO_ROOT / "evaluation" / "metrics.json"
LABEL_CMAP = ListedColormap(["none", "#e5484d", "#30a46c", "none", "#f5d90a"])
REGION_ORDER = ["NCR", "ED", "ET", "TC", "WT"]
REGION_DESC = {
    "NCR": "label 1", "ED": "label 2", "ET": "label 4", "TC": "labels 1+4", "WT": "labels 1+2+4",
}


def load_evaluation() -> Optional[Dict[str, Any]]:
    if EVALUATION_FILE.exists():
        return json.loads(EVALUATION_FILE.read_text(encoding="utf-8"))
    return None


# ---------------------------------------------------------------- figure

def _views(arr, x, y, z):
    """Radiological display: axial/coronal show patient Right on screen-left; sagittal shows Anterior on left."""
    return {
        "Axial": (arr[::-1, ::-1, z].T, ("R", "L", "A", "P")),
        "Coronal": (arr[::-1, y, ::-1].T, ("R", "L", "S", "I")),
        "Sagittal": (arr[x, ::-1, ::-1].T, ("A", "P", "S", "I")),
    }


def snapshot_png(study: ValidatedStudy) -> bytes:
    ref, ornt, canon_affine = vd._canonical(study)
    sp = [float(np.linalg.norm(canon_affine[:3, i])) for i in range(3)]
    flair = vd._reorient(np.asarray(nib.load(study.modalities["FLAIR"]["path"], mmap=False).dataobj, dtype=np.float32), ornt)
    rows = [("Model prediction", vd._labels(study, "pred"))]
    if vd._labels(study, "expert") is not None:
        rows.append(("Expert mask (reference)", vd._labels(study, "expert")))
    rows = [(t, vd._reorient(l, ornt)) for t, l in rows if l is not None]
    lab0 = rows[0][1] if rows else None
    if lab0 is not None and lab0.any():
        x, y, z = (int(round(c)) for c in np.argwhere(lab0 > 0).mean(axis=0))
    else:
        x, y, z = (s // 2 for s in flair.shape)
    nz = flair[flair != 0]
    vmax = float(np.percentile(nz, 99.5)) if nz.size else 1.0
    aspects = {"Axial": sp[1] / sp[0], "Coronal": sp[2] / sp[0], "Sagittal": sp[2] / sp[1]}

    fig, axes = plt.subplots(max(len(rows), 1), 3, figsize=(10, 3.5 * max(len(rows), 1)), squeeze=False)
    for r, (title, lab) in enumerate(rows or [("FLAIR", None)]):
        img_views = _views(flair, x, y, z)
        lab_views = _views(lab, x, y, z) if lab is not None else {}
        for c, name in enumerate(("Axial", "Coronal", "Sagittal")):
            ax = axes[r][c]
            im, (left, right, top, bottom) = img_views[name]
            ax.imshow(im, cmap="gray", vmin=0, vmax=vmax, aspect=aspects[name], interpolation="nearest")
            if name in lab_views:
                ax.imshow(lab_views[name][0], cmap=LABEL_CMAP, vmin=0, vmax=4, alpha=0.45,
                          aspect=aspects[name], interpolation="nearest")
            for txt, pos in ((left, (0.02, 0.5)), (right, (0.98, 0.5)), (top, (0.5, 0.97)), (bottom, (0.5, 0.03))):
                ax.text(*pos, txt, transform=ax.transAxes, color="#38bdf8", fontsize=11, fontweight="bold",
                        ha="center", va="center")
            ax.set_title(f"{title} — {name}", fontsize=9)
            ax.axis("off")
    fig.suptitle(f"FLAIR with overlay: red NCR (1), green ED (2), yellow ET (4). Canonical voxel ({x}, {y}, {z}). "
                 "Suspected regions predicted by the model.", fontsize=8)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110)
    plt.close(fig)
    return buf.getvalue()


# ---------------------------------------------------------------- data

def report_data(study: ValidatedStudy) -> Dict[str, Any]:
    m = vd.meta(study)
    rec = study.metadata.get("prediction") or {}
    return {
        "study_id": study.study_id,
        "generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "meta": m,
        "inputs": rec.get("provenance", {}).get("inputs", {}),
        "evaluation": load_evaluation(),
        "limitations": LIMITATIONS,
        "model": MODEL_INFO,
        "preprocessing": PREPROCESSING,
        "disclaimer": DISCLAIMER,
    }


def _backup_text(m) -> str:
    b = m.get("backup")
    return (f"PRECOMPUTED BACKUP CASE — {b['case']}, generated {b['generated_utc']} by this pipeline. "
            "This is NOT a live run on an uploaded case.") if b else ""


def _backup_html(m) -> str:
    t = _backup_text(m)
    return (f"<p style='background:#7c2d12;color:#ffedd5;padding:8px 12px;border-radius:6px;font-weight:700'>"
            f"{html.escape(t)}</p>") if t else ""


def _fmt(v, nd=3):
    return "—" if v is None else (f"{v:.{nd}f}" if isinstance(v, float) else str(v))


# ---------------------------------------------------------------- HTML

def render_html(study: ValidatedStudy) -> str:
    d = report_data(study)
    m = d["meta"]
    e = html.escape
    img = base64.b64encode(snapshot_png(study)).decode()
    sp = m["spacing_mm"]
    vox = m["voxel_volume_mm3"]

    def vol_rows():
        out = []
        mv, ev = m["volumes"]["model"] or {}, m["volumes"]["expert"] or {}
        for r in REGION_ORDER:
            a = mv.get(r)
            b = ev.get(r)
            out.append(
                f"<tr><td>{r} <span class=muted>({REGION_DESC[r]})</span></td>"
                f"<td>{a['voxels'] if a else '—'}</td><td>{a['voxels'] * vox if a else 0:,.1f}</td>"
                f"<td><b>{a['mL']:.2f}</b></td>"
                + (f"<td>{b['voxels']}</td><td><b>{b['mL']:.2f}</b></td>" if m["has_expert"] else "")
                + "</tr>"
            )
        return "".join(out)

    agreement = ""
    if m["agreement"]:
        rows = "".join(
            f"<tr><td>{r}</td><td>{_fmt(v['dice'])}</td><td>{_fmt(v['sensitivity'])}</td><td>{_fmt(v['hd95_mm'], 1)}</td></tr>"
            for r, v in m["agreement"].items()
        )
        agreement = (
            "<h2>Agreement with the supplied expert mask (this case only)</h2>"
            "<table><tr><th>Region</th><th>Dice</th><th>Sensitivity</th><th>HD95 (mm)</th></tr>" + rows + "</table>"
        )

    ev = d["evaluation"]
    if ev:
        s = ev["summary"]
        rows = "".join(
            f"<tr><td>{r}</td><td>{s[r]['dice_mean']:.3f} ± {s[r]['dice_sd']:.3f}</td>"
            f"<td>{_fmt(s[r]['sensitivity_mean'])} ± {_fmt(s[r]['sensitivity_sd'])}</td>"
            f"<td>{_fmt(s[r]['hd95_median_mm'], 1)}</td></tr>" for r in ("WT", "TC", "ET")
        )
        evaluation = (
            f"<h2>Model evaluation ({ev['n_cases']} held-out labelled cases)</h2>"
            f"<p>{e(ev['dataset'])}. Cases: {e(', '.join(ev['case_ids']))}.</p>"
            "<table><tr><th>Region</th><th>Dice mean ± SD</th><th>Sensitivity mean ± SD</th><th>HD95 median (mm)</th></tr>"
            + rows + "</table>"
            f"<p class=warn><b>Overlap disclosure:</b> {e(ev['overlap_disclosure'])}</p>"
        )
    else:
        evaluation = "<h2>Model evaluation</h2><p class=warn>Evaluation has not been run (evaluation/metrics.json missing).</p>"

    warnings = m["suitability"].get("warnings", [])
    warn_html = ("<ul>" + "".join(f"<li>{e(w)}</li>" for w in warnings) + "</ul>") if warnings else "<p>None.</p>"
    prov = m["provenance"] or {}
    inputs = "".join(
        f"<tr><td>{e(k)}</td><td>{e(v['file'])}</td><td class=mono>{e(v['sha256'])}</td></tr>" for k, v in d["inputs"].items()
    )
    expert_cols = "<th>Expert voxels</th><th>Expert mL</th>" if m["has_expert"] else ""

    return f"""<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width, initial-scale=1">
<title>NeuroScope 3D report</title>
<style>
:root {{ --fg:#111827; --muted:#6b7280; --bg:#ffffff; --line:#e5e7eb; --warn:#92400e; --warnbg:#fef3c7; }}
body {{ font-family: system-ui, Segoe UI, Arial, sans-serif; color:var(--fg); background:var(--bg); max-width: 960px;
       margin: 0 auto; padding: 16px; line-height: 1.45; }}
h1 {{ font-size: 1.5rem; margin: .2rem 0; }} h2 {{ font-size: 1.1rem; margin-top: 1.6rem; border-bottom:1px solid var(--line); }}
table {{ border-collapse: collapse; width: 100%; font-size: .9rem; }} td, th {{ border:1px solid var(--line); padding:4px 6px; text-align:left; }}
.disclaimer {{ background:#fee2e2; color:#7f1d1d; border:1px solid #fca5a5; padding:8px 12px; border-radius:6px; font-weight:600; }}
.warn {{ background:var(--warnbg); color:var(--warn); padding:6px 10px; border-radius:6px; }}
.muted {{ color: var(--muted); }} .mono {{ font-family: Consolas, monospace; font-size: .75rem; word-break: break-all; }}
img {{ max-width: 100%; }} .toolbar a {{ margin-right: 1rem; }}
@media print {{ .toolbar {{ display:none; }} }}
</style></head><body>
<div class=disclaimer>{e(d['disclaimer'])}</div>
{_backup_html(m)}
<p class=toolbar><a href="/api/report/{e(d['study_id'])}.pdf">Download PDF</a><a href="/viewer/{e(d['study_id'])}">Open viewer</a>
<a href="/api/segmentation/prediction/{e(d['study_id'])}">Prediction NIfTI</a></p>
<h1>NeuroScope 3D — estimated tumour-region volumes</h1>
<p class=muted>Study {e(d['study_id'])} · report generated {e(d['generated_utc'])}</p>

<h2>Input</h2>
<table><tr><th>Sequence</th><th>File</th><th>SHA-256</th></tr>{inputs}</table>
<p>Grid {m['original_shape']} voxels, spacing {', '.join(f'{s:.3f}' for s in sp)} mm, orientation {e(m['original_orientation'])}.
Expert mask: {'supplied' if m['has_expert'] else 'not supplied'}.</p>
<h3>Suitability warnings</h3>{warn_html}

<h2>Estimated volumes of suspected regions predicted by the model</h2>
<p><b>Formula:</b> V = N × (Δx × Δy × Δz) = N × ({sp[0]:.3f} × {sp[1]:.3f} × {sp[2]:.3f}) mm³ = N × {vox:.3f} mm³;
&nbsp; mL = mm³ / 1000 (1 mL = 1,000 mm³). N is the number of voxels with the region's BraTS codes.</p>
<table><tr><th>Region</th><th>Model voxels N</th><th>Model mm³</th><th>Model mL</th>{expert_cols}</tr>{vol_rows()}</table>
<p><img alt="Axial, coronal and sagittal FLAIR slices with predicted label overlay" src="data:image/png;base64,{img}"></p>
{agreement}
{evaluation}

<h2>Provenance</h2>
<table>
<tr><td>Model</td><td>{e(MODEL_INFO['name'])}, version {e(MODEL_INFO['version'])}</td></tr>
<tr><td>Licence</td><td>{e(MODEL_INFO['licence'])}</td></tr>
<tr><td>Model training data</td><td>{e(MODEL_INFO['training_data'])}</td></tr>
<tr><td>Preprocessing</td><td>{e(PREPROCESSING)}</td></tr>
<tr><td>Code commit</td><td class=mono>{e(str(prov.get('code_commit', '—')))}</td></tr>
<tr><td>Inference timestamp (UTC)</td><td>{e(str(prov.get('timestamp_utc', '—')))}</td></tr>
<tr><td>Device / inference time</td><td>{e(str(prov.get('device', '—')))} / {e(str(prov.get('inference_seconds', '—')))} s</td></tr>
</table>

<h2>Limitations</h2><ul>{''.join(f'<li>{e(x)}</li>' for x in LIMITATIONS)}</ul>
<div class=disclaimer>{e(d['disclaimer'])}</div>
</body></html>"""


# ---------------------------------------------------------------- PDF

def render_pdf(study: ValidatedStudy) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    d = report_data(study)
    m = d["meta"]
    sp, vox = m["spacing_mm"], m["voxel_volume_mm3"]
    ss = getSampleStyleSheet()
    body = ParagraphStyle("b", parent=ss["BodyText"], fontSize=8.5, leading=11)
    small = ParagraphStyle("s", parent=body, fontSize=7, leading=9)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=11, spaceBefore=8, spaceAfter=4, keepWithNext=1)
    disc = ParagraphStyle("d", parent=body, textColor=colors.HexColor("#7f1d1d"), backColor=colors.HexColor("#fee2e2"),
                          borderPadding=4, fontName="Helvetica-Bold")
    e = html.escape

    def table(rows, widths=None):
        t = Table(rows, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("FONT", (0, 0), (-1, -1), "Helvetica", 7.5), ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7.5),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        return t

    story = [Paragraph(e(d["disclaimer"]), disc), Spacer(1, 6)]
    if _backup_text(m):
        story += [Paragraph(e(_backup_text(m)), ParagraphStyle(
            "bk", parent=body, textColor=colors.HexColor("#ffedd5"), backColor=colors.HexColor("#7c2d12"),
            borderPadding=4, fontName="Helvetica-Bold")), Spacer(1, 6)]
    story += [
             Paragraph("NeuroScope 3D — estimated tumour-region volumes", ss["Title"]),
             Paragraph(f"Study {e(d['study_id'])} · generated {e(d['generated_utc'])}", small)]

    story += [Paragraph("Input", h2), table(
        [["Sequence", "File", "SHA-256"]]
        + [[k, Paragraph(e(v["file"]), small), Paragraph(v["sha256"], small)] for k, v in d["inputs"].items()],
        [20 * mm, 55 * mm, 105 * mm])]
    story.append(Paragraph(
        f"Grid {m['original_shape']} voxels, spacing {', '.join(f'{s:.3f}' for s in sp)} mm, orientation "
        f"{m['original_orientation']}. Expert mask: {'supplied' if m['has_expert'] else 'not supplied'}.", body))
    warnings = m["suitability"].get("warnings", [])
    story.append(Paragraph("<b>Suitability warnings:</b> " + (" ".join(e(w) for w in warnings) if warnings else "none."), body))

    story.append(Paragraph("Estimated volumes of suspected regions predicted by the model", h2))
    story.append(Paragraph(
        f"<b>Formula:</b> V = N × (Δx × Δy × Δz) = N × ({sp[0]:.3f} × {sp[1]:.3f} × {sp[2]:.3f}) mm³ = N × {vox:.3f} mm³; "
        "mL = mm³ / 1000 (1 mL = 1,000 mm³).", body))
    head = ["Region", "Model voxels N", "Model mm³", "Model mL"] + (["Expert voxels", "Expert mL"] if m["has_expert"] else [])
    rows = [head]
    for r in REGION_ORDER:
        a = (m["volumes"]["model"] or {}).get(r)
        row = [f"{r} ({REGION_DESC[r]})", a["voxels"], f"{a['mm3']:,.1f}", f"{a['mL']:.2f}"]
        if m["has_expert"]:
            b = m["volumes"]["expert"][r]
            row += [b["voxels"], f"{b['mL']:.2f}"]
        rows.append(row)
    story.append(table(rows))
    story.append(Spacer(1, 4))
    png = snapshot_png(study)
    img = Image(io.BytesIO(png))
    scale = (180 * mm) / img.imageWidth
    img.drawWidth, img.drawHeight = img.imageWidth * scale, img.imageHeight * scale
    story.append(img)

    if m["agreement"]:
        story.append(Paragraph("Agreement with the supplied expert mask (this case only)", h2))
        story.append(table([["Region", "Dice", "Sensitivity", "HD95 (mm)"]] + [
            [r, _fmt(v["dice"]), _fmt(v["sensitivity"]), _fmt(v["hd95_mm"], 1)] for r, v in m["agreement"].items()]))

    ev = d["evaluation"]
    story.append(Paragraph(f"Model evaluation ({ev['n_cases']} held-out labelled cases)" if ev else "Model evaluation", h2))
    if ev:
        s = ev["summary"]
        story.append(Paragraph(f"{e(ev['dataset'])}. Cases: {e(', '.join(ev['case_ids']))}.", small))
        story.append(table([["Region", "Dice mean ± SD", "Sensitivity mean ± SD", "HD95 median (mm)"]] + [
            [r, f"{s[r]['dice_mean']:.3f} ± {s[r]['dice_sd']:.3f}",
             f"{_fmt(s[r]['sensitivity_mean'])} ± {_fmt(s[r]['sensitivity_sd'])}", _fmt(s[r]["hd95_median_mm"], 1)]
            for r in ("WT", "TC", "ET")]))
        story.append(Paragraph("<b>Overlap disclosure:</b> " + e(ev["overlap_disclosure"]), body))
    else:
        story.append(Paragraph("Evaluation has not been run.", body))

    prov = m["provenance"] or {}
    story.append(Paragraph("Provenance", h2))
    story.append(table([["Item", "Value"]] + [[k, Paragraph(e(str(v)), small)] for k, v in (
        ("Model", f"{MODEL_INFO['name']}, version {MODEL_INFO['version']}"),
        ("Licence", MODEL_INFO["licence"]),
        ("Model training data", MODEL_INFO["training_data"]),
        ("Preprocessing", PREPROCESSING),
        ("Code commit", prov.get("code_commit", "—")),
        ("Inference timestamp (UTC)", prov.get("timestamp_utc", "—")),
        ("Device / inference time", f"{prov.get('device', '—')} / {prov.get('inference_seconds', '—')} s"),
    )], [40 * mm, 140 * mm]))

    story.append(Paragraph("Limitations", h2))
    story += [Paragraph("• " + e(x), body) for x in LIMITATIONS]

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 7)
        canvas.setFillColor(colors.HexColor("#7f1d1d"))
        lines = textwrap.wrap(DISCLAIMER, 150)
        line1, line2 = lines[0], " ".join(lines[1:])
        canvas.drawCentredString(A4[0] / 2, 8 * mm, line1)
        canvas.drawCentredString(A4[0] / 2, 5 * mm, f"{line2}   Page {doc.page}")
        canvas.restoreState()

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=12 * mm,
                      bottomMargin=16 * mm, title="NeuroScope 3D report").build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
