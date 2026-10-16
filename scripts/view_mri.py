
from pathlib import Path
import json

import nibabel as nib
import numpy as np
import matplotlib.pyplot as plt

DATA_DIR = Path(r"D:\NeuroScope3D\data\Task01_BrainTumour")
MRI_FILE = DATA_DIR / "imagesTr" / "BRATS_001.nii.gz"
METADATA_FILE = DATA_DIR / "dataset.json"


def main():
    with METADATA_FILE.open("r", encoding="utf-8") as f:
        metadata = json.load(f)

    image = nib.load(str(MRI_FILE))
    volume = image.get_fdata(dtype=np.float32)

    print("Shape:", volume.shape)
    print("Voxel spacing:", image.header.get_zooms())

    if volume.ndim != 4 or volume.shape[-1] != 4:
        raise ValueError(
            f"Expected a 4D image with 4 channels; got {volume.shape}"
        )

    modality_metadata = metadata["modality"]
    modalities = [
        modality_metadata[str(i)]
        for i in range(volume.shape[-1])
    ]

    print("Channel mapping:")
    for i, name in enumerate(modalities):
        print(f"  {i} -> {name}")

    slice_idx = volume.shape[2] // 2

    fig, axes = plt.subplots(1, 4, figsize=(16, 5))

    for channel, (ax, name) in enumerate(zip(axes, modalities)):
        slice_2d = np.rot90(volume[:, :, slice_idx, channel])
        ax.imshow(slice_2d, cmap="gray")
        ax.set_title(name)
        ax.axis("off")

    fig.suptitle(f"BRATS_001 — axial slice {slice_idx}")
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
