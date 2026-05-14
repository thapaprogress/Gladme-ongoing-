```python
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image
import json
import time

# --- Type Definitions for Clarity ---
BBox = Tuple[int, int, int, int]  # (x_min, y_min, x_max, y_max)
DetectionResult = Dict[str, Any]
ImageBytes = bytes

class ProcessingError(Exception):
    """Custom exception for pipeline failure."""
    pass

# ==============================================================================
# 1. MOCK ML SERVICES (Simulating the Microservices)
#    In a real deployment, these would be separate, optimized services 
#    (e.g., running models via FastAPI endpoints).
# ==============================================================================

class MockDetector:
    """
    Mocks the Detection Service (YOLO/Faster R-CNN).
    Finds bounding boxes for objects in the image.
    """
    def __init__(self, confidence_threshold: float = 0.5):
        self.confidence_threshold = confidence_threshold
        print(f"[Service Mock] Detector initialized with threshold: {confidence_threshold}")

    def detect(self, image: np.ndarray) -> List[BBox]:
        """
        Simulates running an object detection model on the input image.
        Returns a list of bounding boxes.
        """
        # Mock logic: Detect boxes only if the image is not completely black
        if np.mean(image) < 10 and image.size > 100:
            return []
        
        # Mock detection results (simulating 1 to 3 deer detections)
        if np.random.rand() < 0.3:
            return [] # Simulate no detection
        
        bboxes: List[BBox] = []
        num_detections = np.random.randint(1, 4)
        for i in range(num_detections):
            # Generate pseudo-random bounding boxes relative to image size
            h, w, _ = image.shape
            x1 = int(w * (0.1 + 0.2 * i + 0.1 * np.random.rand()))
            y1 = int(h * (0.1 + 0.2 * i + 0.1 * np.random.rand()))
            x2 = int(w * (0.3 + 0.2 * i + 0.1 * np.random.rand()))
            y2 = int(h * (0.2 + 0.2 * i + 0.1 * np.random.rand()))
            bboxes.append((x1, y1, x2, y2))
            
        return bboxes

class MockClassifier:
    """
    Mocks the Classification Service (ResNet/EfficientNet).
    Classifies the species from a cropped Region of Interest (ROI).
    """
    def __init__(self, species_options: List[str]):
        self.species_options = species_options
        print(f"[Service Mock] Classifier initialized for species: {', '.join(species_options)}")

    def classify(self, roi: np.ndarray) -> Tuple[str, float]:
        """
        Simulates running a classification model on the cropped ROI.
        Returns (predicted_label, confidence_score).
        """
        if roi.shape[0] < 10 or roi.shape[1] < 10:
            return "UNKNOWN", 0.0
        
        # Mock logic: Simulate results
        species = np.random.choice(self.species_options)
        confidence = np.random.uniform(0.65, 0.99) if np.random.rand() > 0.1 else np.random.uniform(0.1, 0.5)
        return species, confidence

class MockAttributeEstimator:
    """
    Mocks the Attribute Estimation Module (Optional, advanced classification).
    Determines Sex and Age from a classified ROI.
    """
    def estimate(self, roi: np.ndarray) -> Dict[str, str]:
        """
        Simulates running a secondary model on the ROI.
        Returns predicted attributes.
        """
        if np.random.rand() < 0.1: # Simulate failure 10% of the time
            return {"Sex": "N/A", "Age": "N/A"}
            
        sex = np.random.choice(["Male", "Female"])
        age = np.random.choice(["Young", "Adult", "Mature"])
        return {"Sex": sex, "Age": age}

# ==============================================================================
# 2. CORE PIPELINE LOGIC & SERVICE ORCHESTRATION
# ==============================================================================

class DeerIdentificationService:
    """
    The main service orchestrating the entire CV inference pipeline.
    Handles detection, classification, attribute estimation, and output generation.
    """
    def __init__(self, 
                 detection_threshold: float = 0.5, 
                 classification_threshold: float = 0.75,
                 species_list: List[str] = None):
        
        # Initialize the internal pipeline modules
        self.detector = MockDetector(confidence_threshold=detection_threshold)
        self.classifier = MockClassifier(species_options=species_list)
        self.attribute_estimator = MockAttributeEstimator()
        
        self.DET_THRESHOLD = detection_threshold
        self.CLASSI_THRESHOLD = classification_threshold
        
    def _preprocess_image(self, raw_image: np.ndarray) -> np.ndarray:
        """
        Module B: Loads, normalizes, and standardizes the image data.
        """
        print("\n--- [Step 1] Preprocessing Image ---")
        # Standard practice: Resize and normalize (simulating a 640x640 tensor requirement)
        processed_image = cv2.resize(raw_image, (640, 640))
        # Normalization: Convert to float and divide by 255
        processed_image = processed_image.astype(np.float32) / 255.0
        print(f"Preprocessing complete. Array shape: {processed_image.shape}")
        return processed_image

    def _process_detection_loop(self, original_image: np.ndarray, processed_image: np.ndarray) -> List[DetectionResult]:
        """
        Modules C, D, E: The core detection and classification loop.
        """
        print("\n--- [Step 2] Running Detection & Classification Loop ---")
        
        # Step 2: Detection
        bboxes: List[BBox] = self.detector.detect(original_image)
        
        if not bboxes:
            return []

        print(f"Detected {len(bboxes)} potential deer regions.")
        
        all_detections: List[DetectionResult] = []
        
        # Step 3: Object Refinement & Classification Loop
        for i, bbox in enumerate(bboxes):
            x1, y1, x2, y2 = bbox
            
            # 1. Crop ROI (must happen on the original, non-normalized image)
            # Add padding to prevent edge artifacts during cropping
            padding = 5
            x1_crop = max(0, x1 - padding)
            y1_crop = max(0, y1 - padding)
            x2_crop = min(original_image.shape[1], x2 + padding)
            y2_crop = min(original_image.shape[0], y2 + padding)
            
            roi = original_image[y1_crop:y2_crop, x1_crop:x2_crop]
            
            # 2. Classify
            species, species_conf = self.classifier.classify(roi)
            
            if species_conf < self.CLASSI_THRESHOLD:
                # Skip if classification is uncertain
                print(f"  [Warning] Deer {i+1}: Low confidence ({species_conf:.2f}). Skipping.")
                continue

            # 3. Optional Attributes Estimation
            attributes = self.attribute_estimator.estimate(roi)
            
            # 4. Record Result
            detection_data = {
                "bbox": [x1, y1, x2, y2],
                "species": species,
                "confidence": round(species_conf, 4),
                "attributes": attributes
            }
            all_detections.append(detection_data)
            print(f"  [Success] Deer {i+1}: Identified as {species} (Conf: {species_conf:.2f})")
            
        return all_detections

    def _post_process_and_visualize(self, original_image: np.ndarray, detections: List[DetectionResult]) -> Tuple[np.ndarray, str]:
        """
        Module F: Aggregates results, handles visualization, and formats JSON.
        """
        annotated_image = np.copy(original_image)
        output_summary: Dict[str, Any] = {
            "metadata": {}, # Placeholder for incoming metadata
            "detections": []
        }
        
        for detection in detections:
            bbox = detection["bbox"]
            species = detection["species"]
            conf = detection["confidence"]
            
            # Format Label String
            attr_str = f" | Sex: {detection['attributes'].get('Sex')}, Age: {detection['attributes'].get('Age')}"
            label_text = f"{species}: {conf:.2f}{attr_str}"
            
            # Draw Bounding Box and Label (Visual Output)
            (x1, y1, x2, y2) = map(int, bbox)
            cv2.rectangle(annotated_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated_image, label_text, (x1, y1 - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            # Record structured JSON data
            output_summary["detections"].append({
                "bbox": bbox,
                "label": species,
                "confidence": conf,
                "attributes": detection["attributes"]
            })
        
        return annotated_image, output_summary

    def process_image(self, raw_image: np.ndarray, metadata: Optional[Dict[str, str]] = None) -> Tuple[ImageBytes, str, str]:
        """
        Main Entry Point: Orchestrates the entire pipeline (A -> B -> C -> D -> E -> F).
        
        Returns: (Annotated Image Bytes, JSON Summary, Status Message)
        """
        start_time = time.time()
        print("\n==================================================================")
        print("         STARTING DEER IDENTIFICATION PIPELINE EXECUTION")
        print("==================================================================")

        try:
            # 1. Preprocessing (Module B)
            processed_image = self._preprocess_image(raw_image)

            # 2. Detection & Classification (Modules C, D, E)
            detections = self._process_detection_loop(raw_image, processed_image)
            
            if not detections:
                status_msg = "FAILURE: No deer detected or all detections fell below confidence thresholds."
                print("\n[Pipeline Exit] " + status_msg)
                return cv2.imencode('.jpg', np.zeros(raw_image.shape)).tobytes(), status_msg, "FAILURE"

            # 3. Post-Processing & Output Generation (Module F)
            annotated_image, summary = self._post_process_and_visualize(raw_image, detections)
            
            # Compile final output summary with metadata
            if metadata:
                 summary["metadata"] = metadata
            
            final_json_summary = json.dumps(summary, indent=4)
            
            # Encode the annotated image for output
            image_bytes = cv2.imencode('.jpg', annotated_image)[1].tobytes()
            
            elapsed_time = time.time() - start_time
            status_msg = (f"SUCCESS: Successfully processed {len(detections)} deer detections in {elapsed_time:.2f} seconds.")
            
            return image_bytes, final_json_summary, status_msg

        except ProcessingError as e:
            error_msg = f"PIPELINE FAILED due to processing error: {e}"
            print(error_msg)
            return cv2.imencode('.jpg', np.zeros(10, dtype=np.uint8))[1].tobytes(), f"{{\"error\": \"{error_msg}\"}}", "ERROR"
        except Exception as e:
            error_msg = f"A critical unexpected error occurred: {e}"
            print(error_msg)
            return cv2.imencode('.jpg', np.zeros(10, dtype=np.uint8))[1].tobytes(), f'{{"error": "{error_msg}"}}', "ERROR"

# ==============================================================================
# MAIN EXECUTION BLOCK
# ==============================================================================

def create_mock_image(width: int, height: int, color: tuple = (150, 150, 150)) -> np.ndarray:
    """Creates a structured NumPy array to simulate loading an image."""
    return np.full((height, width, 3), color, dtype=np.uint8)

def main():
    """
    Main entry point for the system simulation.
    """
    # 1. Setup System
    species_list = ["White-tailed Deer", "Mule Deer", "Red Deer", "Elk"]
    service = DeerIdentificationService(species_list=species_list)

    # 2. Simulate Inputs
    # Case 1: Successful Batch Processing (Mocking 3 distinct images)
    image_data_1 = create_mock_image(1024, 768, (100, 150, 100)) # Greenish forest scene
    metadata_1 = {"location": "Yosemite National Park", "date": "2023-10-27"}

    # Case 2: Clean Image / No Detection Expected
    image_data_2 = create_mock_image(1200, 800, (200, 200, 200)) # Bright, empty scene
    metadata_2 = {"location": "Open field", "date": "2023-01-01"}
    
    # Case 3: Empty/Corrupt Image (Simulating failure)
    image_data_3 = np.zeros((10, 10, 3), dtype=np.uint8)


    # --- Run Case 1: Successful Detection ---
    print("\n\n##################################################################")
    print("### PROCESSING IMAGE BATCH 1: SUCCESSFUL DETECTION CASE ###")
    print("##################################################################")
    img_bytes_1, json_summary_1, status_1 = service.process_image(image_data_1, metadata_1)

    print("\n--- RESULT SUMMARY 1 ---")
    print(f"STATUS: {status_1}")
    print(f"JSON OUTPUT:\n{json_summary_1}")
    print(f"Annotated Image Bytes Size: {len(img_bytes_1)} bytes (Simulation)")


    # --- Run Case 2: No Detection Expected ---
    print("\n\n##################################################################")
    print("### PROCESSING IMAGE BATCH 2: NO DETECTION CASE ###")
    print("##################################################################")
    img_bytes_2, json_summary_2, status_2 = service.process_image(image_data_2, None)

    print("\n--- RESULT SUMMARY 2 ---")
    print(f"STATUS: {status_2}")
    print(f"JSON OUTPUT:\n{json_summary_2}")

    # --- Run Case 3: Failure Case ---
    print("\n\n##################################################################")
    print("### PROCESSING IMAGE BATCH 3: FAILURE CASE (Empty Data) ###")
    print("##################################################################")
    img_bytes_3, json_summary_3, status_3 = service.process_image(image_data_3, None)

    print("\n--- RESULT SUMMARY 3 ---")
    print(f"STATUS: {status_3}")
    print(f"JSON OUTPUT:\n{json_summary_3}")


if __name__ == "__main__":
    main()
```