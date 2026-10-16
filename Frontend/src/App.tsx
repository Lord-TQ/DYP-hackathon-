import { useEffect, useRef, useState } from "react"
import { Brain, Slice } from "./Imaging"
import {
  disclaimer,
  regions,
  sequences,
  sequenceCopy,
  type Point,
} from "./data"

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "↗"}</span>
}
function Brand() {
  return (
    <a className="brand" href="#/">
      <span className="brand-icon">
        <i />
        <i />
        <i />
      </span>
      voxel<span className="brand-sub">RESEARCH IMAGING</span>
    </a>
  )
}
function App() {
  const [route, setRoute] = useState(location.hash === "#/viewer")
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const f = () => {
      setRoute(location.hash === "#/viewer")
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", f)
    return () => window.removeEventListener("hashchange", f)
  }, [])
  return (
    <>
      <div hidden={!route}>
        <Viewer ready={ready} setReady={setReady} />
      </div>
      <div hidden={route}>
        <Landing />
      </div>
    </>
  )
}
function Landing() {
  const [sequence, setSequence] = useState(1),
    [scroll, setScroll] = useState(0),
    [menu, setMenu] = useState(false)
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        setScroll(Math.min(window.scrollY / 1000, 1)),
      )
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  return (
    <div className="landing">
      <header className="site-header">
        <Brand />
        <button
          className="mobile-menu"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
        >
          Menu
        </button>
        <nav className={menu ? "open" : ""}>
          <a href="#science">The science</a>
          <a href="#workflow">The workflow</a>
          <a href="#boundaries">Our boundaries</a>
        </nav>
        <a className="header-cta" href="#/viewer">
          Open viewer <Arrow />
        </a>
      </header>
      <main>
        <section className="hero">
          <div className="hero-topline">
            <span>
              <i className="status-dot" /> A NEW PERSPECTIVE ON RESEARCH MRI
            </span>
            <span>V.01 / INTERACTIVE PROTOTYPE</span>
          </div>
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">COMPLEX DATA. CLEARER PERSPECTIVES.</div>
              <h1>
                See a brain
                <br />
                tumour in <em>3D.</em>
                <br />
                Measure it.
                <br />
                <span className="muted-title">Know its limits.</span>
              </h1>
              <p>
                Explore model-predicted tumour regions in research MRI scans.
                Inspect the 3D shape, linked slices, estimated volumes and model
                performance.
              </p>
              <div className="hero-actions">
                <a className="button primary" href="#/viewer">
                  Explore the viewer <Arrow />
                </a>
                <a className="text-link" href="#science">
                  How it works <span>↓</span>
                </a>
              </div>
              <div className="safety-line">
                <span className="small-cross">+</span> Research and teaching
                prototype only — not for diagnosis.
              </div>
            </div>
            <div className="anatomy-stage">
              <div className="stage-top">
                <span>FIG. 01 — SEGMENTED ANATOMY</span>
                <span>3D RECONSTRUCTION / DEMO</span>
              </div>
              <div className="anatomy-grid" />
              <div className="anatomy-ring ring-one" />
              <div className="anatomy-ring ring-two" />
              <span className="axis-label axis-s">S</span>
              <span className="axis-label axis-l">L</span>
              <span className="axis-label axis-r">R</span>
              <span className="axis-label axis-i">I</span>
              <div
                className="brain-wrap"
                style={{
                  transform: `translateX(${
                    reduced ? 0 : scroll * 18
                  }px) scale(${reduced ? 1 : 1 + scroll * 0.06})`,
                }}
              >
                <Brain hero rotation={reduced ? 0 : scroll * 0.45} />
              </div>
              <div className="brain-callout">
                <span className="callout-line" />
                <i /> PREDICTED REGIONS
                <span className="callout-sub">WT / TC / ET</span>
              </div>
              <div className="stage-bottom">
                <span>
                  SAMPLE-001
                  <br />
                  <b>SYNTHETIC TEACHING STUDY</b>
                </span>
                <span>
                  X 095 · Y 095 · Z 090
                  <br />
                  <b>1.0 × 1.0 × 1.0 mm</b>
                </span>
              </div>
            </div>
          </div>
          <div className="hero-footer">
            <span>FROM VOLUME TO UNDERSTANDING.</span>
            <span>
              SCROLL TO EXPLORE <span className="scroll-arrow">↓</span>
            </span>
            <span>RESEARCH, NOT DIAGNOSIS.</span>
          </div>
        </section>
        <section className="sequence-section section" id="science">
          <div className="section-heading">
            <span className="section-index">01 / THE INPUT</span>
            <h2>
              The scan,
              <br />
              <em>opened up.</em>
            </h2>
            <p>
              One study. Four complementary perspectives.
              <br />
              Each sequence makes something different visible.
            </p>
          </div>
          <div className="sequence-grid">
            {sequences.map((s, i) => (
              <button
                key={s}
                className={`sequence-card ${sequence === i ? "selected" : ""}`}
                onClick={() => setSequence(i)}
                aria-pressed={sequence === i}
              >
                <div className="sequence-label">
                  <span>0{i + 1}</span>
                  <b>{s}</b>
                  <span>{sequence === i ? "↗" : "+"}</span>
                </div>
                <Slice sequence={i} compact />
                <span className="sequence-type">
                  {
                    [
                      "ANATOMICAL STRUCTURE",
                      "CONTRAST ENHANCEMENT",
                      "FLUID-SENSITIVE",
                      "FLUID SUPPRESSION",
                    ][i]
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="sequence-description">
            <span className="eyebrow">
              {sequences[sequence]} / A DIFFERENT LENS
            </span>
            <p>{sequenceCopy[sequence]}</p>
            <span className="mono">ILLUSTRATIVE SYNTHETIC SLICES</span>
          </div>
        </section>
        <section className="regions-section section" id="workflow">
          <div>
            <span className="section-index">02 / THE INTERPRETATION</span>
            <h2>
              From voxels
              <br />
              to <em>regions.</em>
            </h2>
            <p>
              A model labels individual voxels. Together, they form nested
              regions you can explore — not a diagnosis you should act on.
            </p>
            <div className="nested-formula">
              ET <span>⊆</span> TC <span>⊆</span> WT
            </div>
          </div>
          <div className="nested-diagram">
            <div className="region-wt">
              <span>WT / Whole tumour</span>
              <div className="region-tc">
                <span>TC / Tumour core</span>
                <div className="region-et">
                  ET
                  <br />
                  <small>Enhancing tumour</small>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="inspect-section section">
          <div className="section-heading">
            <span className="section-index">03 / THE WORKSPACE</span>
            <h2>
              Look closer.
              <br />
              <em>Stay connected.</em>
            </h2>
            <p>
              One shared point. Every perspective.
              <br />
              Rotate the anatomy, move through slices, and see how the regions
              relate.
            </p>
          </div>
          <a href="#/viewer" className="workspace-preview">
            <div className="preview-bar">
              <span>
                <i className="status-dot" /> SAMPLE-001 / LINKED VIEWS
              </span>
              <span>OPEN THE INTERACTIVE VIEWER ↗</span>
            </div>
            <div className="preview-images">
              <div className="preview-brain">
                <Brain />
              </div>
              {[2, 1, 0].map((a) => (
                <div key={a}>
                  <span className="mono">
                    {["SAGITTAL", "CORONAL", "AXIAL"][a]}
                  </span>
                  <Slice axis={a} />
                </div>
              ))}
            </div>
          </a>
        </section>
        <section className="measure-section section">
          <div>
            <span className="section-index">04 / THE CONTEXT</span>
            <h2>
              Numbers need
              <br />
              <em>perspective.</em>
            </h2>
            <p>
              Estimated volume describes a region. Evaluation describes how
              predictions compare with expert labels. Neither tells the whole
              story.
            </p>
            <a className="text-link" href="#/viewer">
              Explore the measurements <Arrow />
            </a>
          </div>
          <div className="measurement">
            <span className="eyebrow">WHOLE TUMOUR / SAMPLE ESTIMATE</span>
            <div className="big-measure">
              {regions[0].volume}
              <small>mL</small>
            </div>
            <div className="measure-rule" />
            <div className="metric-row">
              <span>Illustrative Dice</span>
              <strong>0.89</strong>
              <span>Illustrative sensitivity</span>
              <strong>0.91</strong>
            </div>
            <p>
              Illustrative sample evaluation — not validated performance. No
              trained model is running in this prototype.
            </p>
          </div>
        </section>
        <section className="boundaries section" id="boundaries">
          <span className="section-index">05 / OUR BOUNDARIES</span>
          <h2>
            A tool for exploration.
            <br />
            <em>Not a clinical answer.</em>
          </h2>
          <div className="boundary-grid">
            <p>
              Built for research and teaching with de-identified data in mind.
              This prototype uses a synthetic teaching fixture only, never real
              patient information.
            </p>
            <p>
              No diagnosis. No treatment guidance.
              <br />
              No validated model performance claims.
              <br />
              Always understand the limits of the output.
            </p>
            <a className="button primary" href="#/viewer">
              Explore responsibly <Arrow />
            </a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <Brand />
        <span>AN EXPERIMENT IN SEEING CLEARER.</span>
        <span>RESEARCH & TEACHING ONLY © 2026</span>
      </footer>
    </div>
  )
}

type InputFile = {
  name: string
  size: number
  hash: string
}
function Viewer({
  ready,
  setReady,
}: {
  ready: boolean
  setReady: (b: boolean) => void
}) {
  const [files, setFiles] = useState<(InputFile | null)[]>([
      null,
      null,
      null,
      null,
    ]),
    [sample, setSample] = useState(false),
    [scenario, setScenario] = useState("valid"),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(-1),
    [elapsed, setElapsed] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [point, setPoint] = useState<Point>([95, 95, 90]),
    [sequence, setSequence] = useState(1),
    [enabled, setEnabled] = useState([true, true, true]),
    [opacity, setOpacity] = useState(0.7),
    [rotation, setRotation] = useState(0),
    [zoom, setZoom] = useState(1),
    [mobileAxis, setMobileAxis] = useState(2)
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const reset = () => {
    timers.current.forEach(clearTimeout)
    setProgress(-1)
    setReady(false)
    setError("")
  }
  async function assign(file: File | undefined, i: number) {
    if (!file) return
    reset()
    setSample(false)
    if (!/\.nii(\.gz)?$/i.test(file.name)) {
      setError("Unsupported file. Choose a .nii or .nii.gz file.")
      return
    }
    if (!file.size || file.size > 100 * 1024 * 1024) {
      setError("Files must be nonempty and no larger than 100 MB.")
      return
    }
    if (
      files.some(
        (f, j) => j !== i && f?.name === file.name && f.size === file.size,
      )
    ) {
      setError("This file is already assigned to another sequence.")
      return
    }
    let hash = "Unavailable"
    try {
      const buffer = await file.arrayBuffer()
      hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    } catch {}
    setFiles((old) =>
      old.map((f, j) =>
        i === j ? { name: file.name, size: file.size, hash } : f,
      ),
    )
  }
  const loadSample = () => {
    reset()
    setSample(true)
    setFiles(
      sequences.map((s) => ({
        name: `SAMPLE-001_${s}.nii.gz`,
        size: 0,
        hash: `Fixture identifier: SAMPLE-001-${s}`,
      })),
    )
  }
  const run = () => {
    if (!sample && files.some((f) => !f)) {
      setError(
        "Missing sequence. Add all four files or load the synthetic sample.",
      )
      return
    }
    if (scenario !== "valid") {
      setError(
        ({
          missing:
            "Validation demo: FLAIR is missing. All four sequences are required.",
          unreadable:
            "Validation demo: T2 cannot be read. Replace the simulated file.",
          mismatch:
            "Validation demo: sequence geometry does not match. Use aligned inputs.",
        } as Record<string, string>)[scenario],
      )
      return
    }
    setError("")
    setProgress(0)
    const start = performance.now()
    ;[1, 2, 3].forEach((n) =>
      timers.current.push(
        setTimeout(() => {
          setProgress(n)
          if (n === 3) {
            setElapsed((performance.now() - start) / 1000)
            setReady(true)
          }
        }, n * 1100),
      ),
    )
  }
  const report = () => {
    const data = {
      study: "SAMPLE-001",
      synthetic: true,
      model: "Demo segmentation model v0.1 — simulated",
      regions,
      settings: {
        point,
        sequence: sequences[sequence],
        enabled,
        opacity,
        rotation,
        zoom,
      },
      coordinates:
        "Illustration origin: grid corner; 1 mm isotropic, not clinical registration",
      selectedInputs: { unrelatedToSyntheticPrediction: !sample, files },
      runtime: {
        seconds: elapsed,
        type: "Prototype elapsed time, not inference runtime",
      },
      evaluation: {
        dice: 0.89,
        sensitivity: 0.91,
        label: "Illustrative sample evaluation — not validated performance",
      },
      disclaimer,
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    )
    const a = document.createElement("a")
    a.href = url
    a.download = "VOXEL-SAMPLE-001.json"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="viewer">
      <header className="viewer-header">
        <Brand />
        <a href="#/" className="back-link">
          ← Back to overview
        </a>
        <span className="mono">RESEARCH WORKSPACE / V.01</span>
      </header>
      <div className="viewer-safety">
        <span>+</span>
        {disclaimer}
        <span className="sample-badge">SYNTHETIC DATA</span>
      </div>
      <div className="workspace-title">
        <div>
          <span className="eyebrow">INTERACTIVE IMAGING</span>
          <h1>{ready ? "A closer perspective." : "Start with a study."}</h1>
        </div>
        <div className="workspace-actions">
          {ready ? (
            <>
              <button className="button outline" onClick={reset}>
                New study
              </button>
              <button className="button primary" onClick={report}>
                Export sample report ↓
              </button>
            </>
          ) : (
            <button className="button primary" onClick={loadSample}>
              Load sample study <Arrow />
            </button>
          )}
        </div>
      </div>
      {!ready ? (
        <div className="setup-layout">
          <div className="setup-main">
            <div className="panel-heading">
              <span>01 / FOUR SEQUENCES, ONE STUDY</span>
              <span>NIfTI · .nii / .nii.gz</span>
            </div>
            <p className="setup-intro">Bring the perspectives together.</p>
            <p className="setup-note">
              Prototype workflow. Selected files are not parsed or used for
              prediction. Use the synthetic sample to explore the viewer. Files
              stay on your device.
            </p>
            <div className="upload-grid">
              {sequences.map((s, i) => (
                <label
                  key={s}
                  className={`upload-slot ${files[i] ? "filled" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    void assign(e.dataTransfer.files[0], i)
                  }}
                >
                  <span className="upload-top">
                    <b>{s}</b>
                    <span>{files[i] ? "✓" : "+"}</span>
                  </span>
                  <span className="file-name">
                    {files[i]?.name || "Drop NIfTI file here"}
                  </span>
                  <span className="mono">
                    {files[i] ? "REPLACE FILE ↗" : "OR CLICK TO SELECT ↗"}
                  </span>
                  <input
                    type="file"
                    accept=".nii,.gz"
                    aria-label={`Select ${s} NIfTI file`}
                    onChange={(e) => void assign(e.target.files?.[0], i)}
                  />
                </label>
              ))}
            </div>
            <div className="validation-options">
              <label htmlFor="scenario">VALIDATION DEMO</label>
              <select
                id="scenario"
                value={scenario}
                onChange={(e) => {
                  setScenario(e.target.value)
                  setError("")
                }}
              >
                <option value="valid">Valid sample</option>
                <option value="missing">Missing sequence</option>
                <option value="unreadable">Unreadable sample</option>
                <option value="mismatch">Mismatched geometry</option>
              </select>
            </div>
            <div className="status-message" role="status" aria-live="polite">
              {error ||
                (progress >= 0
                  ? [
                      "Validating sample inputs…",
                      "Simulating preprocessing…",
                      "Simulating region segmentation…",
                      "Sample prediction complete",
                    ][progress]
                  : sample
                    ? "Synthetic sample loaded. Ready to explore."
                    : "No study loaded. Choose files or load the sample study.")}
            </div>
            {error && (
              <p className="error-label">
                No real NIfTI content validation has been performed.
              </p>
            )}
            <div className="setup-bottom">
              <span className="mono">100 MB MAX / FILE · LOCAL ONLY</span>
              {progress >= 0 && progress < 3 ? (
                <button className="button outline" onClick={reset}>
                  Cancel processing
                </button>
              ) : (
                <button className="button primary" onClick={run}>
                  Run sample prediction <Arrow />
                </button>
              )}
            </div>
            {progress >= 0 && (
              <div className="progress-track">
                <span style={{ width: `${(progress + 1) * 25}%` }} />
              </div>
            )}
          </div>
          <aside className="setup-aside">
            <div className="mini-brain">
              <Brain />
            </div>
            <span className="eyebrow">NO FILES? NO PROBLEM.</span>
            <h2>
              Explore a<br />
              <em>synthetic study.</em>
            </h2>
            <p>
              A coordinated teaching fixture, designed to make the workflow
              tangible. No patient data. No real inference.
            </p>
            <button className="text-link" onClick={loadSample}>
              Load SAMPLE-001 <Arrow />
            </button>
            <div className="sample-specs mono">
              160 × 192 × 160 VOXELS
              <br />1 mm ISOTROPIC
              <br />
              FOUR SYNTHETIC SEQUENCES
            </div>
          </aside>
        </div>
      ) : (
        <>
          <div className="study-bar">
            <span>
              <i className="status-dot" /> SAMPLE-001{" "}
              <b>Sample prediction complete</b>
            </span>
            <span>1 mm ISOTROPIC · {sequences[sequence]} · SYNTHETIC</span>
          </div>
          <div className="viewer-grid">
            <div className="imaging-main">
              <section className="brain-panel">
                <div className="panel-heading">
                  <span>01 / SPATIAL VIEW</span>
                  <span>DRAG TO ROTATE</span>
                </div>
                <Brain
                  rotation={rotation}
                  zoom={zoom}
                  enabled={enabled}
                  opacity={opacity}
                  onRotate={setRotation}
                />
                <div className="brain-panel-label mono">
                  SIMULATED 3D ANATOMY
                  <br />
                  NOT AN MRI RECONSTRUCTION
                </div>
                <div className="spatial-controls">
                  <button
                    onClick={() => setRotation(rotation - 0.2)}
                    aria-label="Rotate brain left"
                  >
                    ↶
                  </button>
                  <button
                    onClick={() => setRotation(rotation + 0.2)}
                    aria-label="Rotate brain right"
                  >
                    ↷
                  </button>
                  <label>
                    ZOOM{" "}
                    <input
                      type="range"
                      min=".65"
                      max="1.3"
                      step=".05"
                      value={zoom}
                      onChange={(e) => setZoom(+e.target.value)}
                    />
                  </label>
                  <button
                    onClick={() => {
                      setRotation(0)
                      setZoom(1)
                    }}
                  >
                    Reset
                  </button>
                </div>
              </section>
              <div className="slice-toolbar">
                <span className="mono">02 / LINKED SLICES</span>
                <div>
                  {sequences.map((s, i) => (
                    <button
                      key={s}
                      aria-pressed={sequence === i}
                      className={sequence === i ? "active" : ""}
                      onClick={() => setSequence(i)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mobile-slice-tabs">
                {[2, 1, 0].map((a) => (
                  <button
                    key={a}
                    className={mobileAxis === a ? "active" : ""}
                    onClick={() => setMobileAxis(a)}
                  >
                    {["Sagittal", "Coronal", "Axial"][a]}
                  </button>
                ))}
              </div>
              <div className="slices-grid">
                {[2, 1, 0].map((a) => (
                  <div
                    className={`slice-panel ${
                      mobileAxis === a ? "mobile-active" : ""
                    }`}
                    key={a}
                  >
                    <div className="panel-heading">
                      <span>{["SAGITTAL", "CORONAL", "AXIAL"][a]}</span>
                      <span>{point[a].toString().padStart(3, "0")}</span>
                    </div>
                    <div className="slice-wrap">
                      <Slice
                        axis={a}
                        point={point}
                        sequence={sequence}
                        enabled={enabled}
                        opacity={opacity}
                        onPoint={setPoint}
                      />
                      <span className="orient top">{a === 2 ? "A" : "S"}</span>
                      <span className="orient left">{a === 0 ? "P" : "R"}</span>
                      <span className="orient right">
                        {a === 0 ? "A" : "L"}
                      </span>
                      <span className="orient bottom">
                        {a === 2 ? "P" : "I"}
                      </span>
                    </div>
                    <input
                      aria-label={`${["Sagittal", "Coronal", "Axial"][a]} slice`}
                      type="range"
                      min="0"
                      max={a === 1 ? 191 : 159}
                      value={point[a]}
                      onChange={(e) =>
                        setPoint(
                          point.map((v, i) =>
                            i === a ? +e.target.value : v,
                          ) as Point,
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="coordinate-bar">
                <span>SHARED CROSSHAIR</span>
                {point.map((p, i) => (
                  <label key={i}>
                    {["X", "Y", "Z"][i]}
                    <input
                      type="number"
                      min="0"
                      max={i === 1 ? 191 : 159}
                      value={p}
                      onChange={(e) =>
                        setPoint(
                          point.map((v, j) =>
                            i === j
                              ? Math.max(
                                  0,
                                  Math.min(
                                    i === 1 ? 191 : 159,
                                    Math.round(+e.target.value),
                                  ),
                                )
                              : v,
                          ) as Point,
                        )
                      }
                    />
                  </label>
                ))}
                <span>VOXEL = mm*</span>
              </div>
              <p className="coordinate-note">
                *Illustration origin at grid corner. Not clinical scanner
                coordinates.
              </p>
            </div>
            <aside className="viewer-rail">
              <section>
                <div className="panel-heading">REGIONS & VOLUME ESTIMATES</div>
                {regions.map((r, i) => (
                  <label className="region-control" key={r.id}>
                    <input
                      type="checkbox"
                      checked={enabled[i]}
                      onChange={() =>
                        setEnabled(enabled.map((v, j) => (i === j ? !v : v)))
                      }
                    />
                    <span
                      className="region-dot"
                      style={{ background: r.color }}
                    />
                    <span>
                      <b>{r.id}</b>
                      <small>{r.name}</small>
                    </span>
                    <strong>
                      {r.volume}
                      <small> mL</small>
                    </strong>
                  </label>
                ))}
                <label className="opacity-control">
                  Overlay opacity <span>{Math.round(opacity * 100)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={opacity}
                    onChange={(e) => setOpacity(+e.target.value)}
                  />
                </label>
                <p className="rail-note">
                  Nested regions: ET ⊆ TC ⊆ WT.
                  <br />
                  Synthetic sample estimates, not clinical measurements.
                </p>
              </section>
              <section>
                <div className="panel-heading">ILLUSTRATIVE EVALUATION</div>
                <div className="evaluation">
                  <div>
                    <span>Dice</span>
                    <strong>0.89</strong>
                  </div>
                  <div>
                    <span>Sensitivity</span>
                    <strong>0.91</strong>
                  </div>
                </div>
                <p className="rail-note">
                  Held-out labelled-case evaluation example only. Not validated
                  performance. No trained model is running.
                </p>
              </section>
              <section>
                <details open>
                  <summary>MODEL & PROVENANCE</summary>
                  <dl>
                    <dt>MODEL</dt>
                    <dd>Demo segmentation model v0.1 — simulated</dd>
                    <dt>PREPROCESSING (ILLUSTRATIVE)</dt>
                    <dd>Alignment · resampling · normalization</dd>
                    <dt>ELAPSED PROTOTYPE TIME</dt>
                    <dd>{elapsed.toFixed(2)} s — not inference runtime</dd>
                    <dt>INPUT IDENTIFIERS</dt>
                    {files.map((f, i) => (
                      <dd className="hash" key={i}>
                        {sequences[i]}: {f?.hash || "Synthetic fixture"}
                      </dd>
                    ))}
                  </dl>
                  <p className="rail-note">
                    Selected files are unrelated to this synthetic prediction.
                    No file data leaves this browser.
                  </p>
                </details>
              </section>
            </aside>
          </div>
        </>
      )}
      <footer className="viewer-footer">
        <span>VOXEL / EXPLORE WITH CONTEXT</span>
        <span>PUBLIC-DATA RESEARCH INTENT · SYNTHETIC FIXTURE ONLY</span>
      </footer>
    </div>
  )
}
export default App
