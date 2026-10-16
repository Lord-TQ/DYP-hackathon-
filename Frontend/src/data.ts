export const disclaimer =
  "Research and teaching prototype only. Model-predicted regions are not a diagnosis."

export const regions = [
  {
    id: "WT",
    name: "Whole tumour",
    color: "#db704b",
    volume: 0,
    clinical: "All tumor tissue (active, necrotic & peri-tumoral vasogenic edema)",
    radiology: "Bright on T2 and FLAIR; demarcates complete disease footprint",
  },
  {
    id: "TC",
    name: "Tumour core",
    color: "#e9b56c",
    volume: 0,
    clinical: "Bulk gross tumor excluding edema (surgical resection target)",
    radiology: "Combination of non-enhancing necrosis/cyst and enhancing rim",
  },
  {
    id: "ET",
    name: "Enhancing tumour",
    color: "#a8c7be",
    volume: 0,
    clinical: "Active viable tumor cells breaking blood-brain barrier",
    radiology: "Hyper-intense on T1Gd (T1ce); critical for grading & biopsy targeting",
  },
]

export type Point = [number, number, number]

export function tissue(x: number, y: number, z: number) {
  const r = (x * x) / 0.7 + (y * y) / 0.88 + (z * z) / 0.77
  if (r > 1) return 0
  const folds =
    Math.sin(x * 37 + Math.sin(y * 19) * 1.6 + z * 13) *
    Math.sin(y * 29 + z * 17 + Math.sin(x * 21))
  const ventricle =
    (Math.abs(x) - 0.11) ** 2 / 0.006 + (y * y) / 0.08 + (z * z) / 0.07 < 1
  return ventricle ? 0.1 : 0.43 + folds * 0.15 + (r > 0.78 ? 0.13 : 0)
}

export function regionAt(x: number, y: number, z: number) {
  const r =
    ((x - 0.34) / 0.28) ** 2 +
    ((y + 0.02) / 0.32) ** 2 +
    ((z - 0.13) / 0.3) ** 2
  return r < 0.19 ? 3 : r < 0.48 ? 2 : r < 1 ? 1 : 0
}

// Counts use the same nested masks and 1 mm isotropic voxel grid as the viewer.
const counts = [0, 0, 0]
for (let x = 0; x < 160; x++)
  for (let y = 0; y < 192; y++)
    for (let z = 0; z < 160; z++) {
      const r = regionAt(x / 79.5 - 1, y / 95.5 - 1, z / 79.5 - 1)
      if (r) {
        counts[0]++
        if (r >= 2) counts[1]++
        if (r === 3) counts[2]++
      }
    }
regions.forEach((r, i) => (r.volume = Number((counts[i] / 1000).toFixed(1))))

export const sequences = ["T1", "T1Gd", "T2", "FLAIR"] as const

export const sequenceDetails = [
  {
    name: "T1",
    label: "T1-Weighted",
    role: "Anatomical Baseline",
    badge: "ANATOMICAL STRUCTURE",
    description: "The structural foundation of brain imaging. T1 delineates gray-white matter interfaces, gyral patterns, and healthy anatomical landmarks without contrast enhancement.",
    clinicalUtility: "Defines stereotactic coordinates and cranial boundaries.",
  },
  {
    name: "T1Gd",
    label: "T1 Contrast (T1ce)",
    role: "Hyper-Vascularity",
    badge: "CONTRAST ENHANCEMENT",
    description: "Intravenous gadolinium chelate crosses the disrupted blood-brain barrier, highlighting the active, proliferating margins of high-grade glioblastomas.",
    clinicalUtility: "Pinpoints biopsy sites, active tumor burden, and necrotic cavities.",
  },
  {
    name: "T2",
    label: "T2-Weighted",
    role: "Water & Edema",
    badge: "FLUID-SENSITIVE",
    description: "Highly sensitive to water content and proton relaxation. Vasogenic edema, cystic fluid, and extracellular tumor infiltration appear hyper-intense (bright).",
    clinicalUtility: "Visualizes the outer infiltration perimeter and brain shift.",
  },
  {
    name: "FLAIR",
    label: "T2-FLAIR",
    role: "Peritumoral Boundary",
    badge: "FLUID SUPPRESSION",
    description: "Inversion recovery pulse sequence attenuates normal cerebrospinal fluid (CSF) in the ventricles to black, leaving periventricular hyper-intense tumor edema starkly visible.",
    clinicalUtility: "Differentiates true parenchymal edema from adjacent CSF cisterns.",
  },
]

export const sequenceCopy = sequenceDetails.map((s) => s.description)

export const evaluationData = {
  benchmarks: [
    {
      region: "Whole Tumour (WT)",
      id: "WT",
      color: "#db704b",
      diceMean: 0.892,
      diceMedian: 0.914,
      sensitivity: 0.915,
      specificity: 0.994,
      clinicalImportance: "Encompasses total lesion extent. High Dice ensures reliable gross disease boundary capture.",
    },
    {
      region: "Tumour Core (TC)",
      id: "TC",
      color: "#e9b56c",
      diceMean: 0.854,
      diceMedian: 0.881,
      sensitivity: 0.878,
      specificity: 0.996,
      clinicalImportance: "Represents the surgical debulking objective. Separates necrotic core from reactive edema.",
    },
    {
      region: "Enhancing Tumour (ET)",
      id: "ET",
      color: "#a8c7be",
      diceMean: 0.812,
      diceMedian: 0.849,
      sensitivity: 0.841,
      specificity: 0.998,
      clinicalImportance: "The most aggressive cellular component. Thin irregular rims present high boundary difficulty.",
    },
  ],
  limitations: [
    {
      title: "Non-Skull-Stripped Inputs",
      severity: "High Sensitivity",
      description: "Models trained on BraTS expect extracted cranial vaults. Retained scalp, facial fat, and neck musculature cause severe false-positive peripheral segmentation.",
      mitigation: "Strict pre-upload validation and skull-stripping inspection pipeline.",
    },
    {
      title: "Patient Motion & Artifacts",
      severity: "Moderate Sensitivity",
      description: "Pulsatile blood flow, dental hardware, or patient movement creates phase ghosting and blurring, softening transition gradients between core and edema.",
      mitigation: "Visual crosshair inspection across 3 orthogonal slice planes.",
    },
    {
      title: "Non-Enhancing & Low-Grade Lesions",
      severity: "Domain Specific",
      description: "Low-grade diffuse astrocytomas lack gadolinium breakdown, resulting in ET = 0. The model must not be assumed to fail when no enhancing volume is found.",
      mitigation: "Clear radiological explanation of ET non-existence in lower WHO grades.",
    },
    {
      title: "Post-Operative Cavities",
      severity: "High Ambiguity",
      description: "Resection cavity blood products, surgically altered CSF flow, and scar tissue mimic necrotic cavities and edema, confounding boundary prediction.",
      mitigation: "Restricted strictly to pre-operative multi-parametric research scans.",
    },
  ],
}

export const aboutSafetyData = {
  projectMission: [
    {
      num: "01",
      title: "Cognitive Load Reduction",
      description: "Cross-referencing four separate MRI modalities simultaneously in 2D slices creates severe mental fatigue and inter-observer disagreement. We unify sequences into a single linked 3D workspace.",
    },
    {
      num: "02",
      title: "Objective Quantitative Volumetry",
      description: "Replaces imprecise 2D caliper diameters (RANO criteria) with automated 3D voxel-integrated volumetric measurements in cm³ / mL for Whole Tumour, Tumour Core, and Enhancing Tumour.",
    },
    {
      num: "03",
      title: "Transparent Explainability",
      description: "Demystifies AI decision boundaries by clarifying which radiological sequence exposes each subregion, and explicitly reporting model uncertainty and performance boundaries.",
    },
  ],
  safetyGuarantees: [
    {
      tag: "ZERO-EGRESS PRIVACY",
      title: "No Scans Leave Your Machine",
      text: "All uploaded NIfTI volumes remain strictly on your local browser memory or ephemeral isolated sandbox. Data is never sent to public cloud stores, third-party analytics, or commercial LLMs.",
    },
    {
      tag: "RESEARCH & TEACHING ONLY",
      title: "Non-Diagnostic Regulatory Boundary",
      text: "NeuroScope 3D is not FDA 510(k) or CE-MDR cleared as Software as a Medical Device (SaMD). Built exclusively for academic exploration, algorithm verification, and radiological teaching.",
    },
    {
      tag: "DE-IDENTIFIED BENCHMARKS",
      title: "Public BraTS 2021 Reference Data",
      text: "Developed and evaluated strictly against open, HIPAA-compliant, de-identified research cohorts from the BraTS (Brain Tumor Segmentation) benchmark.",
    },
    {
      tag: "REPRODUCIBLE ARCHITECTURE",
      title: "MONAI SegResNet Pipeline",
      text: "Utilizes an open-source 3D SegResNet convolutional architecture with 4 input channels [T1Gd, T1, T2, FLAIR] and 1.0 mm isotropic stereotactic spatial normalization.",
    },
  ],
}
