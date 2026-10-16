import React from 'react';
import { SegmentationResponse } from '../types';

interface SegmentationResultProps {
  result: SegmentationResponse;
  onReset: () => void;
}

export const SegmentationResult: React.FC<SegmentationResultProps> = ({ result, onReset }) => {
  return (
    <div className="segmentation-result-card">
      <div className="seg-header">
        <h2 className="seg-title">3D Brain Tumor Segmentation: COMPLETE</h2>
        <span className="model-badge">{result.model}</span>
      </div>

      <p className="seg-desc">
        Input channels loaded in strict MONAI SegResNet protocol order:{' '}
        <code>{result.input_channel_order.join(' &rarr; ')}</code>
      </p>

      <div className="volumetrics-grid">
        <div className="volumetric-box wt-box">
          <span className="vol-title">Whole Tumor (WT)</span>
          <span className="vol-sub">(Edema + Core + Enhancing)</span>
          <span className="vol-value">{result.whole_tumor_volume_cm3.toFixed(2)} cm³</span>
          <span className="voxel-count">{result.sub_regions.whole_tumor.voxel_count.toLocaleString()} voxels</span>
        </div>

        <div className="volumetric-box tc-box">
          <span className="vol-title">Tumor Core (TC)</span>
          <span className="vol-sub">(Necrotic + Enhancing)</span>
          <span className="vol-value">{result.tumor_core_volume_cm3.toFixed(2)} cm³</span>
          <span className="voxel-count">{result.sub_regions.tumor_core.voxel_count.toLocaleString()} voxels</span>
        </div>

        <div className="volumetric-box et-box">
          <span className="vol-title">Enhancing Tumor (ET)</span>
          <span className="vol-sub">(Active Hyper-enhancing)</span>
          <span className="vol-value">{result.enhancing_tumor_volume_cm3.toFixed(2)} cm³</span>
          <span className="voxel-count">{result.sub_regions.enhancing_tumor.voxel_count.toLocaleString()} voxels</span>
        </div>
      </div>

      <div className="seg-footer">
        <button type="button" className="btn-secondary" onClick={onReset}>
          Upload Another MRI Study
        </button>
      </div>
    </div>
  );
};
