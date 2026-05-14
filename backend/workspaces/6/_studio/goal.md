Deer Identification Project Goal Instruction

**Objective:**
Develop a robust and accurate computer vision model capable of identifying and classifying specific species or subspecies of deer from photographic images (live or archived).

**Input Requirements:**
1.  **Image Format:** JPEG or PNG files.
2.  **Content:** Photographic images that contain one or more deer (full body, partial body, or close-ups).
3.  **Metadata (Desired):** Location and date taken (to aid species/sex determination).

**Core Functionality:**
1.  **Detection:** Accurately locate the deer within the image, regardless of background clutter or occlusion.
2.  **Classification:** Identify the species (e.g., White-tailed Deer, Mule Deer, Red Deer, Elk - *if expanding scope*).
3.  **Optional Refinement (Advanced):** Determine the sex and approximate age based on visible physical characteristics (e.g., presence/size of antlers, coat condition).

**Output Specifications:**
1.  **Detection Bounding Box:** A visual overlay (coordinates) around the identified deer(s).
2.  **Classification Label:** The predicted name of the deer species (e.g., "White-tailed Deer").
3.  **Confidence Score:** A numerical value (0.0 to 1.0) indicating the model's certainty in the prediction.

**Success Criteria (Acceptance Metrics):**
*   **Accuracy:** Model must achieve >90% classification accuracy on a diverse, unseen test dataset.
*   **Recall:** Must successfully detect and classify deer even when partially obscured or in poor lighting conditions.
*   **Deployment:** The system must be able to process a batch of images (e.g., 100 images) within a reasonable 