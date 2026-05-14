```python
import time
import logging
from typing import List, Optional, Dict
from dataclasses import dataclass, field

# --- Configuration and Constants ---
# Initialize logging for robust field operation
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SWDS_Core")

# Define detection thresholds
CV_CONFIDENCE_THRESHOLD = 0.75
AAM_THREAT_SCORE_THRESHOLD = 0.6
DISTANCE_THRESHOLDS = {
    "FAR": 30.0,
    "MEDIUM": 15.0,
    "CLOSE": 10.0
}

# --- Data Structures (Using dataclasses for Type Safety and Clarity) ---

@dataclass
class MonkeyDetection:
    """Represents a single, tracked monkey detection from the CV Engine."""
    unique_id: int
    confidence: float
    distance_meters: float
    location_2d: tuple  # (x, y) coordinates
    # Tracks historical movement for path analysis
    history: List[tuple] = field(default_factory=list)

@dataclass
class AcousticDetection:
    """Represents the acoustic analysis from the AAM."""
    threat_score: float
    is_monkey_call: bool
    signature_match: str  # e.g., "Alarm Call", "Hooting"
    
@dataclass
class StateReport:
    """Aggregated output from the Perception/Intelligence Layers."""
    monkey_detections: List[MonkeyDetection]
    acoustic_data: Optional[AcousticDetection]
    overall_timestamp: float = field(default_factory=time.time)


@dataclass
class DeterrenceCommand:
    """The final command sent to the Actuator Management System."""
    threat_level: str  # "NONE", "MILD", "STRONG"
    action_details: Dict[str, str]
    duration_seconds: float
    
# --- Mock Modules (Simulating complex hardware/ML inference) ---

class SensorAggregationModule:
    """
    Mocks the SAM: Handles raw data acquisition and synchronization.
    In a real environment, this manages multiple camera feeds, audio buffers, and GPS readings.
    """
    def __init__(self):
        logger.info("SAM Initialized: Data ingestion ready (Mocking data streams).")

    def get_raw_data_frame(self) -> Dict[str, any]:
        """Simulates capturing a synchronized set of raw multimodal data."""
        # In reality, this involves reading from IP streams, mic arrays, and GPS receivers.
        return {
            "video_frame": "binary_data",
            "audio_buffer": "raw_audio_stream",
            "gps_coords": (34.0, -118.0)
        }

class ComputerVisionEngine:
    """
    Mocks the CV Engine (YOLOv8/OpenCV): Detects, tracks, and classifies objects.
    """
    def __init__(self):
        logger.info("CV Engine Initialized: Ready for real-time inference.")

    def process_frame(self, raw_frame: any) -> List[MonkeyDetection]:
        """Simulates running object detection and tracking algorithms."""
        # MOCKING LOGIC: Simulate varied detection outcomes for testing
        if time.time() % 20 < 5:
            # Low detection scenario
            return [
                MonkeyDetection(
                    unique_id=101, confidence=0.85, distance_meters=35.0, location_2d=(100, 50)
                )
            ]
        elif 5 <= (time.time() % 20) < 12:
            # Medium threat scenario (Moderate confidence, medium distance)
            return [
                MonkeyDetection(
                    unique_id=101, confidence=0.78, distance_meters=22.0, location_2d=(120, 60)
                )
            ]
        else:
            # High threat scenario (High confidence, close distance)
            return [
                MonkeyDetection(
                    unique_id=101, confidence=0.92, distance_meters=8.5, location_2d=(150, 70)
                )
            ]

class AcousticAnalysisModule:
    """
    Mocks the AAM: Processes audio to identify characteristic monkey calls.
    """
    def __init__(self):
        logger.info("AAM Initialized: Acoustic signature analysis operational.")

    def analyze_audio(self, raw_audio: any) -> AcousticDetection:
        """Simulates running deep learning models on audio signatures."""
        # MOCKING LOGIC: Simulate varied acoustic outcomes
        if time.time() % 20 < 10:
            # Neutral or low-threat sound
            return AcousticDetection(threat_score=0.3, is_monkey_call=False, signature_match="Wind Noise")
        elif 10 <= (time.time() % 20) < 18:
            # Medium threat call (Warning)
            return AcousticDetection(threat_score=0.65, is_monkey_call=True, signature_match="Warning Call")
        else:
            # High threat call (Danger)
            return AcousticDetection(threat_score=0.88, is_monkey_call=True, signature_match="Alarm Shriek")

# --- Core Logic Modules ---

class DataFusionEngine:
    """
    Fuses inputs from CV and AAM, preparing the structured StateReport.
    This is the critical data preprocessing step.
    """
    def __init__(self, cv_engine: ComputerVisionEngine, aam_module: AcousticAnalysisModule):
        self.cv_engine = cv_engine
        self.aam_module = aam_module

    def perform_fusion(self, raw_data: Dict[str, any]) -> StateReport:
        """
        Runs the full perception cycle: Detect -> Analyze -> Fuse.
        """
        # 1. CV Detection
        monkey_detections = self.cv_engine.process_frame(raw_data["video_frame"])
        
        # 2. Acoustic Analysis
        acoustic_data = self.aam_module.analyze_audio(raw_data["audio_buffer"])
        
        return StateReport(
            monkey_detections=monkey_detections,
            acoustic_data=acoustic_data
        )

class DecisionLogicEngine:
    """
    The core state machine (DLE). Applies rules to the fused data to determine
    the required action (Threat Level).
    """
    def __init__(self, logger: logging.Logger):
        self.logger = logger

    def _calculate_max_threat_level(self, detections: List[MonkeyDetection], acoustics: Optional[AcousticDetection]) -> float:
        """Combines distance, confidence, and acoustic scores into a single normalized threat score."""
        
        # 1. Max Confidence Check (Is the system very sure?)
        max_cv_confidence = max(d.confidence for d in detections) if detections else 0.0
        
        # 2. Min Distance Check (What is the closest monkey?)
        min_distance = min(d.distance_meters for d in detections) if detections else 100.0
        
        # 3. Acoustic Boost (How urgent is the sound?)
        acoustic_boost = acoustics.threat_score if acoustics and acoustics.is_monkey_call else 0.0
        
        # Weighted average combining factors (Weights: Confidence=0.3, Distance=0.3, Audio=0.4)
        # Note: Distance decay is exponential (closer = higher score)
        distance_score = 1.0 - min_distance / 50.0 
        distance_score = max(0.0, distance_score) # Clamp to zero
        
        overall_score = (
            (max_cv_confidence * 0.3) + 
            (distance_score * 0.3) + 
            (acoustic_boost * 0.4)
        )
        return overall_score

    def determine_deterrence_command(self, report: StateReport) -> DeterrenceCommand:
        """
        Runs the core threat matrix logic to select the minimum necessary response.
        """
        detections = report.monkey_detections
        acoustics = report.acoustic_data
        
        if not detections:
            return DeterrenceCommand("NONE", {"message": "No threat detected."}, 0.0)

        overall_score = self._calculate_max_threat_level(detections, acoustics)
        
        # --- Threat Matrix Application ---
        
        if overall_score >= 0.85:
            # High Threat: Critical/Immediate Danger Zone
            return DeterrenceCommand(
                threat_level="STRONG",
                action_details={"type": "Maximum Deterrence", "source": "Critical Proximity/High Confidence"},
                duration_seconds=5.0
            )
        elif overall_score >= 0.55:
            # Medium Threat: Initiate warning/precautionary measure
            return DeterrenceCommand(
                threat_level="MILD",
                action_details={"type": "Visual/Audible Warning", "source": "Proximity/Moderate Confidence"},
                duration_seconds=3.0
            )
        else:
            # Low Threat or Too Far Away
            if overall_score > 0.3 and overall_score < 0.55 and detections:
                 # If detection is present but low threat, we still acknowledge it
                 return DeterrenceCommand(
                    threat_level="PASSIVE",
                    action_details={"type": "Stand By", "source": f"Distance: {min(d.distance_meters for d in detections):.1f}m"},
                    duration_seconds=0.0
                )
            else:
                 return DeterrenceCommand(
                    threat_level="NONE",
                    action_details={"type": "All Clear"},
                    duration_seconds=0.0
                )


class ActuatorManagementSystem:
    """
    Controls physical outputs (Actuators). Executes the command with necessary safety protocols.
    """
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.is_active = False

    def execute_command(self, command: DeterrenceCommand):
        """
        Executes the physical deterrence sequence based on the command's threat level.
        """
        if self.is_active:
            self.logger.warning("Actuator busy. Ignoring new command.")
            return

        level = command.threat_level
        
        self.logger.warning(f"--- ACTUATION SEQUENCE START ({level}) ---")
        
        if level == "NONE":
            self.logger.info("Actuator: Standby mode. No action required.")
            return

        if level == "MILD":
            self.logger.warning("ACTUATOR: Flashing Green Lights & Playing Warning Tone (Soft Volume).")
        elif level == "STRONG":
            self.logger.error("!!! CRITICAL ALERT !!! ACTUATOR: MAXIMUM FLASH LIGHTS & LOUD SIREN ACTIVATION.")
        elif level == "PASSIVE":
            self.logger.info("Actuator: Passive observation. No deterrent force used.")

        self.is_active = True
        time.sleep(0.1) # Simulate hardware delay
        self.logger.warning(f"Actuator: Holding response for {command.duration_seconds} seconds...")
        time.sleep(min(command.duration_seconds, 1.0)) # Limit visible delay
        self.is_active = False
        self.logger.warning("--- ACTUATION SEQUENCE END ---")


# --- Main System Orchestrator ---

class SmartWildlifeDeterrenceSystem:
    """
    The primary orchestration class managing the entire Detection -> Analysis -> Response loop.
    """
    def __init__(self):
        self.logger = logger
        self.sam = SensorAggregationModule()
        self.cv_engine = ComputerVisionEngine()
        self.aam_module = AcousticAnalysisModule()
        self.fusion_engine = DataFusionEngine(self.cv_engine, self.aam_module)
        self.logic_engine = DecisionLogicEngine(self.logger)
        self.actuator_manager = ActuatorManagementSystem(self.logger)
        self.running = True

    def run_cycle(self):
        """
        Executes one full cycle of the Detection, Cognition, and Action loop.
        """
        try:
            # 1. Perception (Detecting the Monkey)
            raw_data = self.sam.get_raw_data_frame()
            state_report = self.fusion_engine.perform_fusion(raw_data)

            self.logger.info("\n[STATUS] Perception Complete: Fused State Report Generated.")
            self.logger.debug(f"Detections: {len(state_report.monkey_detections)}. Acoustic Score: {state_report.acoustic_data.threat_score if state_report.acoustic_data else 'N/A'}")

            # 2. Cognition (Making the Decision)
            deterrence_command = self.logic_engine.determine_deterrence_command(state_report)

            self.logger.info(f"[DECISION] Threat Level Determined: {deterrence_command.threat_level} (Score: {self.logic_engine._calculate_max_threat_level(state_report.monkey_detections, state_report.acoustic_data):.2f})")

            # 3. Action (The Deterrence)
            self.actuator_manager.execute_command(deterrence_command)

        except Exception as e:
            self.logger.error(f"CRITICAL SYSTEM FAILURE in one cycle: {e}", exc_info=True)
            # Implement fail-safe shutdown or warning here

    def start(self, cycles: int = 10):
        """
        The main entry point and operational loop.
        """
        self.logger.info("===================================================================")
        self.logger.info("== Smart Wildlife Deterrence System (SWDS) Activated. STARTING ==")
        self.logger.info("===================================================================")
        
        for i in range(cycles):
            print("\n" + "="*50)
            self.logger.info(f"STARTING CYCLE {i+1}/{cycles}")
            self.run_cycle()
            time.sleep(2.0) # Wait for the next frame/cycle

        self.logger.info("System finished simulation cycles. Shutting down gracefully.")

# --- Main Entry Point ---
if __name__ == "__main__":
    # Set the core logger to a higher detail level for demonstration
    logger.setLevel(logging.INFO) 
    
    swds = SmartWildlifeDeterrenceSystem()
    # Run the full simulation for 5 cycles to demonstrate the different state changes
    swds.start(cycles=5)
```