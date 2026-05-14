This logic describes the step-by-step process the code must execute for every input image.

**1. Input Acquisition & Validation:**
*   **Input:** Accept an image file (JPEG or PNG).
*   **Check:** Validate file integrity and ensure the image is not empty or corrupt.
*   **Action:** Load and preprocess the image (resizing, normalization, color space conversion).

**2. Deer Detection Module (Core Step 1):**
*   **Process:** Run the image through the object detection model (e.g., YOLO, Faster R-CNN).
*   **Output:** A list of detected bounding boxes (`[BBox1, BBox2, ...]`) and associated initial confidence scores.
*   **Decision Point:**
    *   **IF** the list of detected bounding boxes is empty (Confidence < threshold):
        *   **THEN** Flag the image: "No deer detected." (End processing for this image).
    *   **ELSE:** Proceed to object refinement.

**3. Object Refinement & Classification Loop (Core Steps 2 & 3):**
*   *This step iterates through every bounding box detected in Step 2.*
*   **FOR EACH Bounding Box (BBox):**
    1.  **Crop:** Extract the region of interest (ROI) defined by the BBox.
    2.  **Re-scale:** Rescale the cropped ROI to the standard input size required by the classifier.
    3.  **Classify:** Feed the cropped image into the classification model.
    4.  **Receive Output:** Get the predicted class label (`Label`) and the species confidence score (`ConfScore`).
    5.  **Optional Attributes:** If the advanced module is active, run a secondary model to predict attributes (`Sex`, `Age`).

**4. Output Formatting & Output Generation:**
*   **IF** the overall `ConfScore` for a specific deer meets the minimum confidence threshold (e.g., > 0.75):
    1.  **Record:** Store the results for that specific deer:
        *   **BBox:** Coordinates from the original image.
        *   **Label:** Species name (e.g., "White-tailed Deer").
        *   **ConfScore:** The classification probability (0.0 - 1.0).
        *   **Metadata (Optional):** Append predicted Sex/Age.
    2.  **Visual Output:** Draw the bounding box and the label/confidence score onto the original image copy.

**5. Final Result Compilation:**
*   **IF** any successful detections were made in Step 4:
    *   **Result:** Output the list of annotated images and a structured JSON/Dictionary summary containing all detections.
*   **ELSE (Failure):**
    *   **Result:** Output an error/warning message indicating that no deer could be reliably identified.
