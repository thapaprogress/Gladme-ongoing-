from typing import List
from PIL import Image
import numpy as np
from .utils import BBox, ProcessingError

def crop_image(image: Image.Image, bbox: BBox) -> Image.Image:
    """
    Mocks the operation of an Image Processing Microservice.
    Crops the original image based on the detected bounding box.
    
    Args:
        image: The original PIL Image object.
        bbox: The bounding box tuple (x_min, y_min, x_max, y_max).
        
    Returns:
        A new PIL Image object containing only the cropped area.
    
    Raises:
        ProcessingError: If the bounding box is invalid or out of image bounds.
    """
    x_min, y_min, x_max, y_max = bbox
    
    if x_min < 0 or y_min < 0 or x_max > image.size[0] or y_max > image.size[1]:
        raise ProcessingError("Bounding box coordinates are out of image bounds.")
    
    print(f"[Processor] Cropping image to bounds: {bbox}")
    # The actual cropping operation
    try:
        cropped_image = image.crop((x_min, y_min, x_max, y_max))
        return cropped_image
    except Exception as e:
        raise ProcessingError(f"Failed to crop image: {e}")

def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Applies standard preprocessing (e.g., resizing, normalization) 
    required before classification.
    """
    print("[Processor] Normalizing and resizing image for classification...")
    # Mock: Simple resize operation
    return image.resize((224, 224))