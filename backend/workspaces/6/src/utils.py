from typing import List, Dict, Any, Tuple
from PIL import Image
import numpy as np

# --- Type Definitions for Clarity ---
BBox = Tuple[int, int, int, int]  # (x_min, y_min, x_max, y_max)
DetectionResult = Dict[str, Any]
ImageBytes = bytes
ProcessedImage = np.ndarray # Standardizing image data type for internal handling

class ProcessingError(Exception):
    """Custom exception for pipeline failure."""
    pass