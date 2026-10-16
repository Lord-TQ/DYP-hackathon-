"""
In-memory validated study repository for NeuroScope 3D.
Manages study lifecycle, automatic 60-minute expiration, and secure study directory tracking.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import os
from pathlib import Path
import threading
import time
from typing import Any, Dict, Optional

from app.core.exceptions import StudyExpiredError, StudyNotFoundError
from app.core.security import cleanup_study_dir

DEFAULT_STUDY_TTL_SECONDS = 3600  # 60 minutes


@dataclass
class ValidatedStudy:
    """Represents a validated multi-sequence MRI study ready for segmentation."""
    study_id: str
    study_dir: Path
    modalities: Dict[str, Dict[str, Any]]
    metadata: Dict[str, Any]
    validated: bool = True
    created_timestamp: float = field(default_factory=time.time)
    ttl_seconds: float = DEFAULT_STUDY_TTL_SECONDS

    @property
    def created_at(self) -> str:
        return datetime.fromtimestamp(self.created_timestamp, tz=timezone.utc).isoformat()

    @property
    def expires_at(self) -> str:
        return datetime.fromtimestamp(self.created_timestamp + self.ttl_seconds, tz=timezone.utc).isoformat()

    @property
    def is_expired(self) -> bool:
        return (time.time() - self.created_timestamp) > self.ttl_seconds


class StudyStore:
    """Thread-safe store of validated studies."""

    def __init__(self, ttl_seconds: float = DEFAULT_STUDY_TTL_SECONDS):
        self.ttl_seconds = ttl_seconds
        self._studies: Dict[str, ValidatedStudy] = {}
        self._lock = threading.Lock()

    def register_study(
        self,
        study_id: str,
        study_dir: Path,
        modalities: Dict[str, Dict[str, Any]],
        metadata: Dict[str, Any],
        ttl_seconds: Optional[float] = None,
    ) -> ValidatedStudy:
        """Register a successfully validated MRI study."""
        self.clean_expired_studies()
        study = ValidatedStudy(
            study_id=study_id,
            study_dir=study_dir,
            modalities=modalities,
            metadata=metadata,
            validated=True,
            created_timestamp=time.time(),
            ttl_seconds=ttl_seconds or self.ttl_seconds,
        )
        with self._lock:
            self._studies[study_id] = study
        return study

    def get_validated_study(self, study_id: str) -> ValidatedStudy:
        """
        Retrieve validated study by study_id.
        Raises StudyNotFoundError if not found, or StudyExpiredError if expired.
        """
        with self._lock:
            study = self._studies.get(study_id)

        if not study:
            raise StudyNotFoundError(study_id=study_id)

        if study.is_expired:
            self.delete_study(study_id)
            raise StudyExpiredError(study_id=study_id)

        return study

    def is_valid_study(self, study_id: str) -> bool:
        """Check if study exists, is validated, and has not expired."""
        try:
            study = self.get_validated_study(study_id)
            return study.validated and not study.is_expired
        except Exception:
            return False

    def delete_study(self, study_id: str):
        """Remove a study and delete its temporary files from disk."""
        with self._lock:
            study = self._studies.pop(study_id, None)
        if study and study.study_dir:
            cleanup_study_dir(study.study_dir)

    def clean_expired_studies(self):
        """Clean up all studies that have exceeded their TTL."""
        expired_ids = []
        with self._lock:
            for s_id, study in list(self._studies.items()):
                if study.is_expired:
                    expired_ids.append((s_id, study.study_dir))
                    del self._studies[s_id]

        for _, s_dir in expired_ids:
            if s_dir:
                cleanup_study_dir(s_dir)

    def clear(self):
        """Clear all registered studies and their files (primarily for test tearDown)."""
        with self._lock:
            studies = list(self._studies.values())
            self._studies.clear()
        for study in studies:
            cleanup_study_dir(study.study_dir)


# Global singleton store
study_store = StudyStore()
