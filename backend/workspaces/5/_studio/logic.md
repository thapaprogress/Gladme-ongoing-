The entire system operates as a continuous, three-stage loop: **Detection $\rightarrow$ Analysis $\rightarrow$ Response**.

Here is the logic broken down into plain words:

### 🐒 Stage 1: Perception (Detecting the Monkey)

This stage is purely observational. Its job is to look at every incoming picture frame and answer one question: *Is a monkey present, and where is it?*

1.  **Scanning:** The system constantly scans the frame using advanced computer vision algorithms.
2.  **Filtering (Species Recognition):** It filters out everything that is not relevant. It must confirm that the detected animal matches the profile of a monkey.
3.  **Tracking:** It doesn't just detect; it tracks. It assigns a unique ID to the monkey and estimates its movement path over time, preventing false alarms from single frames.
4.  **Output:** A list of active, tracked monkey locations and the confidence level of the sighting.

### 🧠 Stage 2: Cognition (Making the Decision)

This is the 'brain' of the system. It takes the raw data from Stage 1 and applies rules to determine if a threat level is crossed.

1.  **Distance Check (The "How Close" Filter):** First, it checks the distance. If the monkey is too far away (e.g., more than 30 meters), the system ignores it, as no action is needed.
2.  **Confidence Check (The "How Sure" Filter):** It looks at the system's certainty. If multiple sightings are happening, or if the confidence level is extremely high (e.g., over 90%), the threat level increases.
3.  **Escalation Logic (The "When to Act"):** It combines the proximity and confidence into a threat matrix:
    *   **Low Threat:** Monkey detected, but far away or low confidence. $\rightarrow$ *Action: Stand by (Passive).*
    *   **Medium Threat:** Monkey detected and close (e.g., 15-30 meters), moderate confidence. $\rightarrow$ *Action: Initiate mild warning.*
    *   **High Threat (Critical):** Monkey detected, very close (e.g., less than 10 meters), and high confidence. $\rightarrow$ *Action: Trigger full, escalating deterrent.*

### 🚀 Stage 3: Action (The Deterrence)

This stage executes the minimum amount of force necessary based on the decision from Stage 2. The principle is always **escalation**—start small and only increase the force if the threat level increases.

1.  **Passive/Standby:** No action. The system simply logs the event and monitors.
2.  **Mild Deterrent (Warning):** If the monkey is mildly threatening, the system executes a non-aggressive, low-level warning. This usually involves a **visual flash** (lights) and a **recorded warning sound** (like a human voice or alarm tone).
3.  **Strong Deterrent (Full Response):** If the monkey persists or moves into the immediate danger zone, the system escalates. This involves the **loudest siren/alarm sound** combined with the **maximum light flash** to achieve maximum psychological impact and deter the animal.