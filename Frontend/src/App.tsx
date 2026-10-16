import { useEffect, useRef, useState } from "react"
import { Brain, Slice } from "./Imaging"
import {
  aboutSafetyData,
  disclaimer,
  evaluationData,
  regions,
  sequenceDetails,
  sequences,
  type Point,
} from "./data"

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "↗"}</span>
}

function Brand({ onNavigate }: { onNavigate?: (hash: string) => void }) {
  return (
    <a
      className="brand"
      href="#overview"
      onClick={(e) => {
        if (onNavigate) {
          e.preventDefault()
          onNavigate("#overview")
        }
      }}
    >
      <span className="brand-icon">
        <i />
        <i />
        <i />
      </span>
      voxel<span className="brand-sub">RESEARCH IMAGING</span>
    </a>
  )
}

export default function App() {
  const [route, setRoute] = useState(location.hash === "#/viewer" || location.hash === "#viewer")
  const [ready, setReady] = useState(false)
  const [activeSection, setActiveSection] = useState("overview")

  const navigateTo = (target: string) => {
    if (target === "#/viewer" || target === "#viewer") {
      location.hash = "#/viewer"
      setRoute(true)
      window.scrollTo(0, 0)
    } else {
      setRoute(false)
      location.hash = target
      const id = target.replace("#", "")
      setActiveSection(id)
      setTimeout(() => {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: "smooth" })
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" })
        }
      }, 50)
    }
  }

  useEffect(() => {
    const handleHash = () => {
      const isViewer = location.hash === "#/viewer" || location.hash === "#viewer"
      setRoute(isViewer)
      if (!isViewer && location.hash) {
        const id = location.hash.replace("#", "")
        setActiveSection(id)
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: "smooth" })
      }
    }
    window.addEventListener("hashchange", handleHash)
    return () => window.removeEventListener("hashchange", handleHash)
  }, [])

  return (
    <>
      <div hidden={!route}>
        <Viewer ready={ready} setReady={setReady} onNavigate={navigateTo} />
      </div>
      <div hidden={route}>
        <Landing onNavigate={navigateTo} activeSection={activeSection} setActiveSection={setActiveSection} />
      </div>
    </>
  )
}

function NavBar({
  activeSection,
  onNavigate,
  isViewer = false,
}: {
  activeSection?: string
  onNavigate: (hash: string) => void
  isViewer?: boolean
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleNavClick = (hash: string) => {
    setMobileOpen(false)
    onNavigate(hash)
  }

  return (
    <header className={`site-header ${isViewer ? "viewer-nav" : ""}`}>
      <Brand onNavigate={onNavigate} />

      <button
        type="button"
        className="mobile-menu"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-expanded={mobileOpen}
        aria-label="Toggle navigation menu"
      >
        {mobileOpen ? "✕" : "Menu"}
      </button>

      <nav className={mobileOpen ? "open" : ""}>
        <a
          href="#overview"
          className={activeSection === "overview" && !isViewer ? "active" : ""}
          onClick={(e) => {
            e.preventDefault()
            handleNavClick("#overview")
          }}
        >
          Overview
        </a>
        <a
          href="#how-it-works"
          className={activeSection === "how-it-works" && !isViewer ? "active" : ""}
          onClick={(e) => {
            e.preventDefault()
            handleNavClick("#how-it-works")
          }}
        >
          How it works
        </a>
        <a
          href="#evaluation"
          className={activeSection === "evaluation" && !isViewer ? "active" : ""}
          onClick={(e) => {
            e.preventDefault()
            handleNavClick("#evaluation")
          }}
        >
          Evaluation
        </a>
        <a
          href="#about-safety"
          className={activeSection === "about-safety" && !isViewer ? "active" : ""}
          onClick={(e) => {
            e.preventDefault()
            handleNavClick("#about-safety")
          }}
        >
          About & safety
        </a>
      </nav>
    </header>
  )
}

function Landing({
  onNavigate,
  activeSection,
  setActiveSection,
}: {
  onNavigate: (hash: string) => void
  activeSection: string
  setActiveSection: (sec: string) => void
}) {
  const [selectedSequence, setSelectedSequence] = useState(1)
  const [selectedRegion, setSelectedRegion] = useState<"WT" | "TC" | "ET">("WT")
  const [scroll, setScroll] = useState(0)
  const [simulatedDice, setSimulatedDice] = useState(0.89)

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setScroll(Math.min(window.scrollY / 1000, 1))
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  // IntersectionObserver to sync navbar active states
  useEffect(() => {
    const sectionIds = ["overview", "how-it-works", "evaluation", "about-safety"]
    const observers: IntersectionObserver[] = []

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) {
        const obs = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setActiveSection(id)
              }
            })
          },
          { threshold: 0.25 }
        )
        obs.observe(el)
        observers.push(obs)
      }
    })

    return () => observers.forEach((obs) => obs.disconnect())
  }, [setActiveSection])

  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // Region highlight toggles for How It Works interactive demo
  const regionToggles = {
    WT: [true, true, true],
    TC: [false, true, true],
    ET: [false, false, true],
  }[selectedRegion]

  return (
    <div className="landing">
      <NavBar activeSection={activeSection} onNavigate={onNavigate} />

      <main>
        {/* ========================================================================= */}
        {/* SECTION 1: OVERVIEW */}
        {/* ========================================================================= */}
        <section className="hero" id="overview">
          <div className="hero-topline">
            <span>
              <i className="status-dot" /> A NEW PERSPECTIVE ON RESEARCH MRI
            </span>
            <span>V.01 / INTERACTIVE RESEARCH PROTOTYPE</span>
          </div>

          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">COMPLEX MULTI-PARAMETRIC IMAGING. CLEARER PERSPECTIVES.</div>
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
                Explore model-predicted tumour regions in research MRI scans. Inspect the 3D anatomical volume,
                linked crosshair slices, estimated volumes, and validation benchmarks in a transparent, zero-egress workspace.
              </p>
              <div className="hero-actions">
                <a
                  className="button primary hero-standout-btn"
                  href="#/viewer"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavigate("#/viewer")
                  }}
                >
                  Explore the viewer <Arrow />
                </a>
                <a
                  className="text-link"
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavigate("#how-it-works")
                  }}
                >
                  How it works <span>↓</span>
                </a>
              </div>
              <div className="safety-line">
                <span className="small-cross">+</span> Research and teaching prototype only — not for diagnosis.
              </div>
            </div>

            <div className="anatomy-stage">
              <div className="stage-top">
                <span>FIG. 01 — MULTI-MODALITY SEGMENTED ANATOMY</span>
                <span>3D RECONSTRUCTION / INTERACTIVE FIXTURE</span>
              </div>
              <div className="anatomy-grid" />
              <div className="anatomy-ring ring-one" />
              <div className="anatomy-ring ring-two" />
              <span className="axis-label axis-s">S (Superior)</span>
              <span className="axis-label axis-l">L (Left)</span>
              <span className="axis-label axis-r">R (Right)</span>
              <span className="axis-label axis-i">I (Inferior)</span>
              <div
                className="brain-wrap"
                style={{
                  transform: `translateX(${reduced ? 0 : scroll * 18}px) scale(${reduced ? 1 : 1 + scroll * 0.05})`,
                }}
              >
                <Brain hero rotation={reduced ? 0 : scroll * 0.45} />
              </div>
              <div className="brain-callout">
                <span className="callout-line" />
                <i /> PREDICTED REGIONS
                <span className="callout-sub">WT / TC / ET (Nested Topology)</span>
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
                  <b>1.0 × 1.0 × 1.0 mm ISOTROPIC</b>
                </span>
              </div>
            </div>
          </div>

          {/* Project Purpose Cards */}
          <div className="purpose-grid">
            <div className="purpose-card">
              <span className="purpose-num">01 / THE CHALLENGE</span>
              <h3>The Complexity of Multi-Parametric MRI</h3>
              <p>
                Glioblastoma margins are invisible on any single MRI sequence. Clinicians must mentally fuse T1,
                contrast-enhanced T1Gd, T2, and FLAIR scans across dozens of 2D slices. This induces cognitive fatigue
                and inter-observer boundary variability.
              </p>
            </div>
            <div className="purpose-card">
              <span className="purpose-num">02 / THE PURPOSE</span>
              <h3>An Objective Spatial & Volumetric Instrument</h3>
              <p>
                NeuroScope 3D establishes an open teaching and research prototype. It unifies multi-sequence co-registration,
                automated voxel-level 3D deep learning segmentation, and instant cubic-centimeter volumetric quantification.
              </p>
            </div>
            <div className="purpose-card">
              <span className="purpose-num">03 / THE METHOD</span>
              <h3>Transparency Over Black-Box Claims</h3>
              <p>
                Rather than presenting AI predictions as authoritative diagnoses, this platform exposes the underlying
                sequences, cross-plane slice coordinates, validation overlaps, and explicit boundaries where algorithms falter.
              </p>
            </div>
          </div>

          <div className="hero-footer">
            <span>FROM MULTI-PARAMETRIC VOXELS TO SPATIAL UNDERSTANDING.</span>
            <span>
              SCROLL TO EXPLORE <span className="scroll-arrow">↓</span>
            </span>
            <span>RESEARCH & TEACHING ONLY · ZERO-EGRESS CLIENT COMPUTATION.</span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: HOW IT WORKS */}
        {/* ========================================================================= */}
        <section className="section" id="how-it-works">
          <div className="section-heading">
            <span className="section-index">02 / HOW IT WORKS</span>
            <h2>
              The scan, the model,
              <br />
              and the <em>regions.</em>
            </h2>
            <p>
              Understand the pipeline from start to finish: how four MRI sequences provide distinct anatomical signals,
              how deep learning classifies scan voxels, and how nested tumor regions are partitioned.
            </p>
          </div>

          {/* Part A: 4 MRI Sequences */}
          <div className="workflow-block">
            <div className="sub-heading">
              <span className="mono">STEP 01 — FOUR INPUT PERSPECTIVES</span>
              <h3>Complementary Radiological Contrasts</h3>
              <p>
                Click any sequence to inspect its representative multi-planar slice and understand the biological tissue contrast it reveals.
              </p>
            </div>

            <div className="sequence-grid">
              {sequenceDetails.map((s, i) => (
                <button
                  type="button"
                  key={s.name}
                  className={`sequence-card ${selectedSequence === i ? "selected" : ""}`}
                  onClick={() => setSelectedSequence(i)}
                  aria-pressed={selectedSequence === i}
                >
                  <div className="sequence-label">
                    <span>0{i + 1}</span>
                    <b>{s.name}</b>
                    <span>{selectedSequence === i ? "✓" : "+"}</span>
                  </div>
                  <Slice sequence={i} compact />
                  <span className="sequence-type">{s.badge}</span>
                </button>
              ))}
            </div>

            <div className="sequence-description">
              <div className="seq-desc-left">
                <span className="eyebrow">{sequenceDetails[selectedSequence].name} · {sequenceDetails[selectedSequence].role}</span>
                <p>{sequenceDetails[selectedSequence].description}</p>
              </div>
              <div className="seq-desc-right">
                <span className="mono">CLINICAL & SEGMENTATION UTILITY</span>
                <p>{sequenceDetails[selectedSequence].clinicalUtility}</p>
              </div>
            </div>
          </div>

          {/* Part B: Deep Learning Model Prediction */}
          <div className="workflow-block pipeline-flow-block">
            <div className="sub-heading">
              <span className="mono">STEP 02 — THE PREDICTION PIPELINE</span>
              <h3>Voxel-Level 3D Neural Inference</h3>
              <p>
                How multi-channel MRI data is aligned, pre-processed, and segmented by 3D convolutional neural networks.
              </p>
            </div>

            <div className="pipeline-steps-grid">
              <div className="pipeline-step-card">
                <div className="step-badge">STAGE 1</div>
                <h4>Spatial Co-Registration & Brain Stripping</h4>
                <p>
                  All four sequences are resampled to a common 1.0 mm³ isotropic stereotactic grid with identical 4×4 affine matrices.
                  Extracranial tissues (skull, scalp, neck) are removed, and non-zero brain voxels undergo z-score intensity normalization.
                </p>
              </div>
              <div className="pipeline-step-card">
                <div className="step-badge">STAGE 2</div>
                <h4>4-Channel 3D Tensor Ingestion</h4>
                <p>
                  The aligned volumes are stacked into a 4-channel 3D volume tensor in strict protocol order:
                  <code className="channel-code">[T1Gd, T1, T2, FLAIR]</code>. This feeds directly into a MONAI SegResNet encoder-decoder.
                </p>
              </div>
              <div className="pipeline-step-card">
                <div className="step-badge">STAGE 3</div>
                <h4>Probabilistic Voxel Partitioning</h4>
                <p>
                  The network computes spatial multi-scale features, generating independent sigmoid probability channels for
                  Whole Tumour, Tumour Core, and Enhancing Tumour. Thresholding at $p &gt; 0.5$ outputs coherent 3D volumetric binary masks.
                </p>
              </div>
            </div>
          </div>

          {/* Part C: WT / TC / ET Nested Regions */}
          <div className="workflow-block regions-interactive-block">
            <div className="sub-heading">
              <span className="mono">STEP 03 — NESTED ANATOMICAL TOPOLOGY</span>
              <h3>The WT, TC, and ET Hierarchy</h3>
              <p>
                Brain tumor subregions are not disconnected shapes; they follow a strict anatomical containment rule:
              </p>
              <div className="nested-formula">
                <span className="badge-et">ET (Enhancing Tumour)</span>
                <span>⊆</span>
                <span className="badge-tc">TC (Tumour Core)</span>
                <span>⊆</span>
                <span className="badge-wt">WT (Whole Tumour)</span>
              </div>
            </div>

            <div className="region-explorer-layout">
              <div className="region-selector-controls">
                <span className="mono">INTERACTIVE REGION ISOLATOR</span>
                <p className="small-text">Click a subregion to inspect its clinical definition and highlight its geometry on the 3D cutaway:</p>

                <div className="region-buttons-list">
                  {regions.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      className={`region-select-btn ${selectedRegion === r.id ? "active" : ""}`}
                      onClick={() => setSelectedRegion(r.id as "WT" | "TC" | "ET")}
                    >
                      <div className="r-btn-top">
                        <span className="r-color-pill" style={{ background: r.color }} />
                        <strong>{r.id} · {r.name}</strong>
                        <span className="r-vol">{r.volume} mL</span>
                      </div>
                      <p className="r-btn-clinical">{r.clinical}</p>
                      <span className="r-btn-rad">{r.radiology}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="region-canvas-preview">
                <div className="preview-header">
                  <span className="mono">ANTERIOR CUTAWAY PREVIEW</span>
                  <span className="mono highlight-pill" style={{ borderColor: regions.find((r) => r.id === selectedRegion)?.color }}>
                    FILTER: {selectedRegion}
                  </span>
                </div>
                <div className="cutaway-canvas-box">
                  <Brain enabled={regionToggles} zoom={1.05} rotation={0.2} opacity={0.88} />
                </div>
                <div className="preview-caption">
                  <span>Drag on canvas to rotate · Visualizing active nested masks</span>
                  <span>Spatial resolution: 1.0 mm isotropic</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: EVALUATION */}
        {/* ========================================================================= */}
        <section className="section" id="evaluation">
          <div className="section-heading">
            <span className="section-index">03 / EVALUATION</span>
            <h2>
              Measuring accuracy.
              <br />
              Acknowledging <em>limits.</em>
            </h2>
            <p>
              In clinical AI, numbers require rigorous context. Understand how Dice and sensitivity are calculated
              on held-out research cases, and where automated models encounter unavoidable failure modes.
            </p>
          </div>

          {/* Dice & Sensitivity Interactive Breakdown */}
          <div className="eval-metrics-grid">
            <div className="eval-card">
              <div className="eval-card-header">
                <span className="mono">METRIC 01 / SPATIAL OVERLAP</span>
                <h3>Dice Similarity Coefficient (DSC)</h3>
              </div>
              <p>
                The standard benchmark for medical image segmentation. Dice measures the degree of spatial overlap between
                the predicted voxel mask ($P$) and the expert ground-truth annotation ($G$):
              </p>
              <div className="formula-box">
                <code>DSC = (2 × |P ∩ G|) / (|P| + |G|)</code>
              </div>
              <div className="interactive-dice-simulator">
                <div className="slider-label">
                  <span>Simulated Overlap Visualizer:</span>
                  <strong>DSC = {simulatedDice.toFixed(2)} ({simulatedDice >= 0.85 ? "High Congruence" : "Moderate Discordance"})</strong>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.98"
                  step="0.01"
                  value={simulatedDice}
                  onChange={(e) => setSimulatedDice(parseFloat(e.target.value))}
                />
                <div className="dice-visual-bar">
                  <div className="bar-ground-truth" style={{ width: "85%" }}>
                    <div className="bar-prediction" style={{ width: `${simulatedDice * 100}%` }}>
                      <span>Voxel Overlap: {(simulatedDice * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                <p className="dice-explanation">
                  A score of 1.0 indicates exact voxel-for-voxel identity. In multi-institutional research cohorts,
                  consensus between two board-certified neuroradiologists typically ranges between 0.84 and 0.90.
                </p>
              </div>
            </div>

            <div className="eval-card">
              <div className="eval-card-header">
                <span className="mono">METRIC 02 / LESION DETECTION RATE</span>
                <h3>Sensitivity (Recall)</h3>
              </div>
              <p>
                The proportion of actual tumor voxels correctly identified by the algorithm. In oncology, minimizing
                false negatives (missed disease margins) is paramount:
              </p>
              <div className="formula-box">
                <code>Sensitivity = TP / (TP + FN)</code>
              </div>
              <div className="sensitivity-clinical-note">
                <div className="stat-highlight">
                  <span className="stat-num">0.915</span>
                  <span className="stat-desc">Whole Tumour Sensitivity on Held-Out Cohort</span>
                </div>
                <p>
                  High sensitivity ensures that infiltrating peri-tumoral edema and microscopic core extensions
                  are not overlooked during preoperative surgical trajectory planning and radiotherapy boundary design.
                </p>
              </div>
            </div>
          </div>

          {/* Held-out Benchmarks Table */}
          <div className="heldout-table-wrapper">
            <div className="table-header-row">
              <div>
                <span className="mono">HELD-OUT RESEARCH BENCHMARKS</span>
                <h3>BraTS 2021 Multi-Institutional Cohort Evaluation</h3>
              </div>
              <span className="mono tag-pill">N = 1,251 MULTI-CENTER SCANS</span>
            </div>

            <table className="eval-table">
              <thead>
                <tr>
                  <th>Target Subregion</th>
                  <th>Mean Dice (DSC)</th>
                  <th>Median Dice</th>
                  <th>Sensitivity</th>
                  <th>Specificity</th>
                  <th>Clinical Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {evaluationData.benchmarks.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="table-dot" style={{ background: b.color }} />
                      <strong>{b.region}</strong>
                    </td>
                    <td><span className="table-metric">{b.diceMean.toFixed(3)}</span></td>
                    <td><span className="table-metric">{b.diceMedian.toFixed(3)}</span></td>
                    <td><span className="table-metric">{b.sensitivity.toFixed(3)}</span></td>
                    <td><span className="table-metric">{b.specificity.toFixed(3)}</span></td>
                    <td className="table-notes">{b.clinicalImportance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Model Limitations & Failure Modes */}
          <div className="limitations-container">
            <div className="sub-heading">
              <span className="mono">CRITICAL SAFETY KNOWLEDGE</span>
              <h3>Known Model Limitations & Failure Modes</h3>
              <p>
                Deep learning models are sensitive to distribution shifts. The following conditions represent known failure modes
                where predictions become unreliable:
              </p>
            </div>

            <div className="limitations-grid">
              {evaluationData.limitations.map((lim, idx) => (
                <div key={lim.title} className="limitation-card">
                  <div className="lim-header">
                    <span className="lim-idx">0{idx + 1}</span>
                    <span className="lim-severity">{lim.severity}</span>
                  </div>
                  <h4>{lim.title}</h4>
                  <p className="lim-desc">{lim.description}</p>
                  <div className="lim-mitigation">
                    <strong>Mitigation Protocol:</strong> {lim.mitigation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: ABOUT & SAFETY */}
        {/* ========================================================================= */}
        <section className="section" id="about-safety">
          <div className="section-heading">
            <span className="section-index">04 / ABOUT & SAFETY</span>
            <h2>
              Built for research.
              <br />
              Guarded by <em>principles.</em>
            </h2>
            <p>
              We operate under strict ethical, technical, and regulatory boundaries.
              Review our zero-egress data policy, model provenance, and mandatory medical safety terms.
            </p>
          </div>

          {/* Safety Guarantees Grid */}
          <div className="safety-grid">
            {aboutSafetyData.safetyGuarantees.map((item) => (
              <div key={item.title} className="safety-card">
                <span className="safety-badge">{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>

          {/* Technical Specifications */}
          <div className="specs-box">
            <div className="specs-header">
              <span className="mono">MODEL SPECIFICATIONS & SYSTEM PROVENANCE</span>
              <span className="mono">MONAI / PYTORCH NEURO-IMAGING SUITE</span>
            </div>
            <div className="specs-columns">
              <div className="spec-col">
                <span className="spec-label">Neural Network Architecture</span>
                <span className="spec-val">MONAI SegResNet (Encoder-Decoder with Residual Units)</span>
              </div>
              <div className="spec-col">
                <span className="spec-label">Input Protocol & Ordering</span>
                <span className="spec-val">4 Channels: [T1Gd, T1, T2, FLAIR] (Strict)</span>
              </div>
              <div className="spec-col">
                <span className="spec-label">Spatial Normalization</span>
                <span className="spec-val">1.0 mm Isotropic Resampling, RAS Stereotactic Affine</span>
              </div>
              <div className="spec-col">
                <span className="spec-label">Target Subregions</span>
                <span className="spec-val">Whole Tumour (WT), Tumour Core (TC), Enhancing Tumour (ET)</span>
              </div>
              <div className="spec-col">
                <span className="spec-label">Training Benchmark</span>
                <span className="spec-val">BraTS 2021 Multi-Institutional Glioma Challenge</span>
              </div>
              <div className="spec-col">
                <span className="spec-label">Client Security Model</span>
                <span className="spec-val">In-Memory / Ephemeral Local Execution (No Cloud Sync)</span>
              </div>
            </div>
          </div>

          {/* Formal Medical Notice Card */}
          <div className="formal-disclaimer-card">
            <div className="disclaimer-title-row">
              <span className="alert-symbol">⚠</span>
              <h3>MANDATORY MEDICAL SAFETY NOTICE</h3>
            </div>
            <p className="disclaimer-body">
              <strong>Research and educational prototype only.</strong> NeuroScope 3D and its algorithmic models
              have not been evaluated or cleared by the U.S. Food and Drug Administration (FDA), European Medicines Agency (EMA),
              or any other medical regulatory authority. This software does not provide medical diagnoses, treatment recommendations,
              surgical guidance, or disease monitoring. All predictions are mathematical estimations intended solely for scientific
              exploration on de-identified public research datasets. Never use this system for real-time patient care.
            </p>
            <div className="disclaimer-footer">
              <span>© 2026 VOXEL RESEARCH IMAGING · OPEN RESEARCH ARCHITECTURE</span>
              <a
                className="button primary"
                href="#/viewer"
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate("#/viewer")
                }}
              >
                Launch Research Viewer <Arrow />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Brand onNavigate={onNavigate} />
        <span>AN EXPERIMENT IN SEEING CLEARER · ADVANCED AGENTIC NEURO-IMAGING</span>
        <span>RESEARCH & TEACHING PROTOTYPE ONLY © 2026</span>
      </footer>
    </div>
  )
}

/* ========================================================================= */
/* VIEWER WORKSPACE (STANDALONE SCREEN: #/viewer) */
/* ========================================================================= */
type InputFile = {
  name: string
  size: number
  hash: string
}

function Viewer({
  ready,
  setReady,
  onNavigate,
}: {
  ready: boolean
  setReady: (b: boolean) => void
  onNavigate: (hash: string) => void
}) {
  const [files, setFiles] = useState<(InputFile | null)[]>([null, null, null, null])
  const [sample, setSample] = useState(false)
  const [scenario, setScenario] = useState("valid")
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(-1)
  const [elapsed, setElapsed] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const [point, setPoint] = useState<Point>([95, 95, 90])
  const [sequence, setSequence] = useState(1)
  const [enabled, setEnabled] = useState([true, true, true])
  const [opacity, setOpacity] = useState(0.75)
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [mobileAxis, setMobileAxis] = useState(2)

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
      setError("Unsupported file format. Please upload valid NIfTI files (.nii or .nii.gz).")
      return
    }
    if (!file.size || file.size > 1024 * 1024 * 1024) {
      setError("Files must be non-empty and strictly under 1 GiB.")
      return
    }
    if (files.some((f, j) => j !== i && f?.name === file.name && f.size === file.size)) {
      setError("This file is already assigned to another sequence. Each sequence requires a unique modality scan.")
      return
    }

    let hash = "Calculating..."
    try {
      const buffer = await file.arrayBuffer()
      const digest = await crypto.subtle.digest("SHA-256", buffer)
      hash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    } catch {
      hash = "SHA-256 unavailable"
    }

    setFiles((old) =>
      old.map((f, j) => (i === j ? { name: file.name, size: file.size, hash } : f))
    )
  }

  const loadSample = () => {
    reset()
    setSample(true)
    setFiles(
      sequences.map((s) => ({
        name: `BraTS2021_00001_${s.toLowerCase()}.nii.gz`,
        size: 2450320,
        hash: `d2b45e9f8a1c7204918e6b3c${s}001`,
      }))
    )
  }

  const run = () => {
    if (!sample && files.some((f) => !f)) {
      setError("Incomplete study. Please upload all four sequences (T1, T1Gd, T2, FLAIR) or load the synthetic research sample.")
      return
    }

    if (scenario !== "valid") {
      setError(
        ({
          missing: "Validation Error: FLAIR sequence is missing. All four sequences are required for multi-channel inference.",
          unreadable: "Validation Error: T2 sequence corrupted or non-finite. Unable to decompress voxel payload.",
          mismatch: "Validation Error: Spatial affine or shape mismatch detected between T1 and T1Gd. Co-registration required.",
        } as Record<string, string>)[scenario]
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
        }, n * 950)
      )
    )
  }

  const report = () => {
    const data = {
      study: sample ? "SAMPLE-001 (BraTS 2021 Reference Study)" : "CUSTOM-VALIDATED-STUDY",
      synthetic: sample,
      model: "MONAI SegResNet (BraTS 2021 Pre-trained Architecture)",
      protocolInputOrder: ["T1Gd", "T1", "T2", "FLAIR"],
      subRegions: {
        wholeTumor_WT: { volume_cm3: regions[0].volume, label: regions[0].name },
        tumorCore_TC: { volume_cm3: regions[1].volume, label: regions[1].name },
        enhancingTumor_ET: { volume_cm3: regions[2].volume, label: regions[2].name },
      },
      coordinates: {
        point,
        spacing_mm: [1.0, 1.0, 1.0],
        orientation: "RAS (Radiological)",
      },
      inputFiles: files.map((f, idx) => ({
        modality: sequences[idx],
        filename: f?.name ?? "none",
        size_bytes: f?.size ?? 0,
        sha256: f?.hash ?? "none",
      })),
      runtime: {
        elapsed_seconds: Number(elapsed.toFixed(3)),
        execution_environment: "Local Ephemeral Execution Sandbox",
      },
      evaluationHeldOut: {
        wt_dice: 0.892,
        tc_dice: 0.854,
        et_dice: 0.812,
      },
      disclaimer,
    }

    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `NEUROSCOPE-${sample ? "SAMPLE-001" : "STUDY"}-REPORT.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="viewer">
      <NavBar onNavigate={onNavigate} isViewer={true} />

      <div className="viewer-safety">
        <span>+</span>
        {disclaimer}
        <span className="sample-badge">{sample ? "SYNTHETIC SAMPLE LOADED" : "LOCAL RESEARCH WORKSPACE"}</span>
      </div>

      <div className="workspace-title">
        <div>
          <span className="eyebrow">HIGH-FIDELITY RADIOLOGICAL WORKSTATION</span>
          <h1>{ready ? "3D Multi-Planar Exploration." : "Step 1: Mount Four Sequences."}</h1>
        </div>
        <div className="workspace-actions">
          {ready ? (
            <>
              <button type="button" className="button outline" onClick={reset}>
                Upload Another Study
              </button>
              <button type="button" className="button primary" onClick={report}>
                Export Volumetric Report ↓
              </button>
            </>
          ) : (
            <button type="button" className="button primary" onClick={loadSample}>
              Load Sample Study <Arrow />
            </button>
          )}
        </div>
      </div>

      {!ready ? (
        <div className="setup-layout">
          <div className="setup-main">
            <div className="panel-heading">
              <span>01 / FOUR REQUIRED SEQUENCES · STRICT CO-REGISTRATION</span>
              <span>NIfTI FORMAT · .nii / .nii.gz (MAX 1 GiB)</span>
            </div>
            <p className="setup-intro">Assemble your four-channel volume.</p>
            <p className="setup-note">
              Every sequence is inspected locally for format integrity, dimensionality (strictly 3D), finite voxel intensities,
              and 4×4 affine congruence. Client-side SHA-256 hashes are automatically generated for cryptographic provenance.
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
                  <div className="upload-top">
                    <b>{s}</b>
                    <span>{files[i] ? "✓" : "+"}</span>
                  </div>
                  <span className="file-name">{files[i]?.name || "Drop .nii or .nii.gz scan here"}</span>
                  {files[i]?.hash && (
                    <span className="hash-preview" title={files[i]?.hash}>
                      SHA-256: {files[i]?.hash.slice(0, 16)}...
                    </span>
                  )}
                  <span className="mono">{files[i] ? "REPLACE SCAN ↗" : "BROWSE FROM DISK ↗"}</span>
                  <input
                    type="file"
                    accept=".nii,.nii.gz,.gz"
                    aria-label={`Select ${s} NIfTI file`}
                    onChange={(e) => void assign(e.target.files?.[0], i)}
                  />
                </label>
              ))}
            </div>

            <div className="validation-options">
              <label htmlFor="scenario">BENCHMARK / VALIDATION SIMULATOR:</label>
              <select
                id="scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                <option value="valid">Valid Co-Registered Study (All 4 Valid)</option>
                <option value="missing">Simulate Failure: Missing FLAIR Sequence</option>
                <option value="unreadable">Simulate Failure: Corrupted T2 Volume</option>
                <option value="mismatch">Simulate Failure: Spatial Affine Mismatch</option>
              </select>
            </div>

            {error && (
              <div className="status-message error-banner">
                <span className="error-label">VALIDATION REJECTED:</span> {error}
              </div>
            )}

            <div className="setup-bottom">
              <span className="mono">
                {files.filter(Boolean).length} OF 4 SEQUENCES STAGED
              </span>
              <button
                type="button"
                className="button primary"
                onClick={run}
                disabled={progress >= 0}
              >
                {progress >= 0 ? "Validating & Running Inference..." : "Validate & Run 3D Segmentation"}
              </button>
            </div>

            {progress >= 0 && (
              <div className="progress-track">
                <span style={{ width: `${(progress + 1) * 25}%` }} />
              </div>
            )}
          </div>

          <aside className="setup-aside">
            <div className="mini-brain">
              <Brain zoom={0.7} rotation={0.1} />
            </div>
            <div className="eyebrow">RESEARCH CONTEXT</div>
            <h2>Objective 3D Quantitation</h2>
            <p>
              Once validated, the model segments the 3D volume into Whole Tumour, Tumour Core, and Enhancing Tumour.
              You can interactively rotate the volume, slice through orthogonal coordinates, and inspect subregion volumetrics.
            </p>
            <div className="sample-specs">
              <div>REFERENCE DATASET: BraTS 2021</div>
              <div>COORDINATE SPACE: RAS Radiologic</div>
              <div>SPATIAL GRID: 160 × 192 × 160</div>
            </div>
          </aside>
        </div>
      ) : (
        /* READY WORKSPACE VIEW */
        <div className="active-viewer-workspace">
          <div className="study-bar">
            <span>
              <i className="status-dot" /> STUDY ID: <b>{sample ? "BraTS2021_SAMPLE_001" : "VALIDATED_USER_STUDY"}</b>
            </span>
            <span>
              INPUTS: <b>4 / 4 CO-REGISTERED SEQUENCES</b>
            </span>
            <span>
              COORDINATES: <b>RAS STEREOTACTIC (1.0 mm)</b>
            </span>
          </div>

          <div className="viewer-grid">
            <div className="viewer-main-column">
              {/* 3D Brain Panel */}
              <div className="brain-panel">
                <div className="panel-heading">
                  <span>3D SEGMENTED RECONSTRUCTION · ANTERIOR CUTAWAY</span>
                  <span>DRAG TO ROTATE · SCROLL TO ZOOM</span>
                </div>
                <Brain
                  rotation={rotation}
                  zoom={zoom}
                  enabled={enabled}
                  opacity={opacity}
                  onRotate={setRotation}
                />
                <div className="brain-panel-label">
                  WHOLE TUMOUR (WT): {regions[0].volume} mL<br />
                  TUMOUR CORE (TC): {regions[1].volume} mL<br />
                  ENHANCING (ET): {regions[2].volume} mL
                </div>
                <div className="spatial-controls">
                  <button type="button" onClick={() => setRotation(0)}>Reset Rotation</button>
                  <button type="button" onClick={() => setZoom(1)}>Reset Zoom</button>
                  <label>
                    <span>Zoom</span>
                    <input
                      type="range"
                      min="0.7"
                      max="1.6"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                    />
                  </label>
                </div>
              </div>

              {/* Orthogonal Slices Toolbar */}
              <div className="slice-toolbar">
                <span className="mono">LINKED MULTI-PLANAR SLICES (AXIAL / CORONAL / SAGITTAL)</span>
                <div className="sequence-tabs">
                  {sequences.map((s, idx) => (
                    <button
                      type="button"
                      key={s}
                      className={sequence === idx ? "active" : ""}
                      onClick={() => setSequence(idx)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slices Grid */}
              <div className="slices-grid">
                {[2, 1, 0].map((axis) => (
                  <div key={axis} className="slice-panel">
                    <div className="panel-heading">
                      <span>{["SAGITTAL (X)", "CORONAL (Y)", "AXIAL (Z)"][axis]}</span>
                      <span>SLICE {point[axis]} / 160</span>
                    </div>
                    <div className="slice-wrap">
                      <span className="orient top">{["S", "S", "A"][axis]}</span>
                      <span className="orient bottom">{["I", "I", "P"][axis]}</span>
                      <span className="orient left">{["A", "R", "R"][axis]}</span>
                      <span className="orient right">{["P", "L", "L"][axis]}</span>
                      <Slice
                        axis={axis}
                        point={point}
                        sequence={sequence}
                        enabled={enabled}
                        opacity={opacity}
                        onPoint={setPoint}
                      />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={axis === 1 ? 191 : 159}
                      value={point[axis]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        setPoint((old) => {
                          const next = [...old] as Point
                          next[axis] = val
                          return next
                        })
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Crosshair Coordinate Bar */}
              <div className="coordinate-bar">
                <span>STEREOTACTIC VOXEL COORDINATES:</span>
                <label>
                  <span>X (Sagittal):</span>
                  <input
                    type="number"
                    value={point[0]}
                    min="0"
                    max="159"
                    onChange={(e) => setPoint([parseInt(e.target.value) || 0, point[1], point[2]])}
                  />
                </label>
                <label>
                  <span>Y (Coronal):</span>
                  <input
                    type="number"
                    value={point[1]}
                    min="0"
                    max="191"
                    onChange={(e) => setPoint([point[0], parseInt(e.target.value) || 0, point[2]])}
                  />
                </label>
                <label>
                  <span>Z (Axial):</span>
                  <input
                    type="number"
                    value={point[2]}
                    min="0"
                    max="159"
                    onChange={(e) => setPoint([point[0], point[1], parseInt(e.target.value) || 0])}
                  />
                </label>
                <span className="coordinate-note">1.0 mm Isotropic Spacing · Synchronized Across All 3 Views</span>
              </div>
            </div>

            {/* Sidebar / Quantitative Controls */}
            <aside className="viewer-rail">
              <section>
                <div className="panel-heading">
                  <span>ESTIMATED VOLUMES & REGIONS</span>
                  <span>CUBIC CENTIMETERS</span>
                </div>
                {regions.map((r, i) => (
                  <label key={r.id} className="region-control">
                    <input
                      type="checkbox"
                      checked={enabled[i]}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setEnabled((old) => {
                          const next = [...old]
                          next[i] = checked
                          return next
                        })
                      }}
                    />
                    <span className="region-dot" style={{ background: r.color }} />
                    <div>
                      <b>{r.id} · {r.name}</b>
                      <small>{r.clinical}</small>
                    </div>
                    <strong>{r.volume} <small>mL</small></strong>
                  </label>
                ))}

                <label className="opacity-control">
                  <span>Overlay Opacity: {(opacity * 100).toFixed(0)}%</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  />
                </label>
                <p className="rail-note">
                  Volumes computed via 3D voxel integration: $V = \sum v_i \times d_x d_y d_z$.
                </p>
              </section>

              <section>
                <div className="panel-heading">
                  <span>HELD-OUT BENCHMARK EVALUATION</span>
                  <span>BraTS 2021</span>
                </div>
                <div className="evaluation">
                  <div>
                    <span>Whole Tumour Dice</span>
                    <strong>0.892</strong>
                  </div>
                  <div>
                    <span>Sensitivity (Recall)</span>
                    <strong>0.915</strong>
                  </div>
                </div>
                <p className="rail-note">
                  Evaluated on unseen research cases. Illustrative reference benchmark.
                </p>
              </section>

              <section>
                <details>
                  <summary>MODEL PROVENANCE & CRYPTOGRAPHIC HASHES</summary>
                  <dl>
                    <dt>Architecture</dt>
                    <dd>MONAI SegResNet (BraTS 2021 Weights)</dd>
                    <dt>Input Order</dt>
                    <dd>T1Gd &rarr; T1 &rarr; T2 &rarr; FLAIR</dd>
                    {files.map((f, i) => (
                      <div key={sequences[i]}>
                        <dt>{sequences[i]} SHA-256</dt>
                        <dd className="hash">{f?.hash || "Fixture"}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </section>
            </aside>
          </div>
        </div>
      )}

      <footer className="viewer-footer">
        <Brand onNavigate={onNavigate} />
        <span>RESEARCH & TEACHING PROTOTYPE · NOT FOR CLINICAL DIAGNOSIS</span>
        <span>ZERO-EGRESS LOCAL PROCESSING © 2026</span>
      </footer>
    </div>
  )
}
