from PIL import Image
import numpy as np
from .utils import ProcessingError

def classify_deer(image: Image.Image) -> str:
    """
    Mocks the operation of a Species Classification Microservice.
    Takes a cropped/processed image and determines the species.
    
    Args:
        image: The processed (resized) PIL Image object.
        
    Returns:
        The identified species name (str).
    
    Raises:
        ProcessingError: If the classification service fails.
    """
    print("[Classifier] Sending processed image for species classification...")
    
    # Mock implementation: Simulate classification logic
    if image.size[0] < 10:
        raise ProcessingError("Image too small for classification.")

    # Randomly mock a result
    species_list = ["Whitetail Deer", "Mule Deer", "Blacktail Deer", "Species Unknown"]
    import random
    result = random.choice(species_list)
    
    print(f"[Classifier] Classification complete. Identified species: {result}")
    return result