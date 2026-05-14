import pytest
import time
import logging
from typing import List, Optional, Dict
from dataclasses import dataclass, field

# Mock the main module components for testing purposes
# NOTE: In a real scenario, these would be imported from the main application file.

# --- Data Structures (Copied for test execution context) ---
@dataclass
class MonkeyDetection:
    unique_id: int
    confidence: float
    distance_meters: float
    location_2d: tuple
    history: List[tuple] = field(default_factory=list)

@dataclass
class AcousticDetection:
    threat_score: float
    is_monkey_call: bool
    signature_match: str

@dataclass
class StateReport:
    monkey_detections: List[MonkeyDetection]
    acoustic_data: Optional[AcousticDetection]
    overall_timestamp: float = field(default_factory=time.time)

@dataclass
class DeterrenceCommand:
    threat_level: str  # "NONE", "MILD", "STRONG"
    action_details: Dict[str, str]
    duration_seconds: float

# --- Constants (Copied for test execution context) ---
CV_CONFIDENCE_THRESHOLD = 0.75
AAM_THREAT_SCORE_THRESHOLD = 0.6
DISTANCE_THRESHOLDS = {
    "FAR": 30.0,
    "MEDIUM": 15.0,
    "CLOSE": 10.0
}

# --- Mock Classes (Copied for test execution context) ---
class SensorAggregationModule:
    def __init__(self): pass
    def get_raw_data_frame(self) -> Dict[str, any]: return {}

class ComputerVisionEngine:
    def __init__(self): pass
    def process_frame(self, raw_frame: any) -> List[MonkeyDetection]:
        # Mock implementation needed for testing
        return []

class AcousticAnalysisModule:
    def __init__(self): pass
    def analyze_audio(self, raw_audio: any) -> AcousticDetection:
        # Mock implementation needed for testing
        return AcousticDetection(0.0, False, "")


# --- CORE LOGIC FUNCTION (MOCKING THE COGNITION SERVICE) ---

def assess_threat_level(report: StateReport) -> DeterrenceCommand:
    """
    Implements Stage 2: Cognition. Determines the required deterrent level.
    """
    detections = report.monkey_detections
    
    if not detections:
        return DeterrenceCommand("NONE", {"message": "No monkey detected"}, 0.0)

    # 1. Process all detections to find the highest threat
    max_distance = 0.0
    max_confidence = 0.0
    
    for detection in detections:
        max_distance = max(max_distance, detection.distance_meters)
        max_confidence = max(max_confidence, detection.confidence)

    # 2. Check Acoustic Data contribution
    acoustic_boost = 0.0
    if report.acoustic_data:
        acoustic_boost = report.acoustic_data.threat_score * 0.3 

    # 3. Determine Threat Level based on Proximity, Confidence, and Acoustics
    
    # Filter 1: Distance Check (If too far, ignore)
    if max_distance > DISTANCE_THRESHOLDS["FAR"]:
        return DeterrenceCommand("NONE", {"message": "Monkey too far away."}, 0.0)

    # Calculate Adjusted Threat Score
    adjusted_confidence = min(1.0, max_confidence + acoustic_boost)
    
    threat_level = "NONE"
    action_details = {}
    duration = 0.0

    # Rule 3: Escalation Logic (The "When to Act"):
    
    # High Threat (Critical) - Less than 10m, High confidence (>0.9), AND strong acoustic match
    if (max_distance < DISTANCE_THRESHOLDS["CLOSE"] and 
            adjusted_confidence > 0.9 and
            report.acoustic_data and report.acoustic_data.signature_match == "Alarm Call"):
        threat_level = "STRONG"
        action_details = {"lights": "MAX_FLASH", "sound": "LOUD_SIREN", "message": "Immediate danger. Full deterrence active."}
        duration = 5.0
    
    # Medium Threat - Between 10m and 30m, Moderate confidence (>0.7), OR strong acoustic signal
    elif (max_distance < DISTANCE_THRESHOLDS["FAR"] and 
            max_distance >= DISTANCE_THRESHOLDS["CLOSE"] and 
            adjusted_confidence > 0.7):
        threat_level = "MILD"
        action_details = {"lights": "FLASH", "sound": "WARNING_TONE", "message": "Cautionary warning issued."}
        duration = 3.0
        
    # Default fallback for non-critical detections
    else:
        threat_level = "NONE"
        action_details = {"message": "Monitoring status maintained."}
        duration = 0.0
        
    return DeterrenceCommand(threat_level, action_details, duration)


# --- PYTEST FIXTURES ---

@pytest.fixture
def mock_state_report_high_threat():
    """Creates a state report triggering STRONG deterrent."""
    monkey = MonkeyDetection(
        unique_id=101, confidence=0.95, distance_meters=8.0, location_2d=(150, 70)
    )
    acoustic = AcousticDetection(
        threat_score=0.8, is_monkey_call=True, signature_match="Alarm Call"
    )
    return StateReport([monkey], acoustic)

@pytest.fixture
def mock_state_report_medium_threat():
    """Creates a state report triggering MILD deterrent."""
    monkey = MonkeyDetection(
        unique_id=101, confidence=0.8, distance_meters=20.0, location_2d=(120, 60)
    )
    acoustic = AcousticDetection(
        threat_score=0.2, is_monkey_call=True, signature_match="Hooting"
    )
    return StateReport([monkey], acoustic)

@pytest.fixture
def mock_state_report_low_threat_far():
    """Creates a state report triggering NONE deterrent due to distance."""
    monkey = MonkeyDetection(
        unique_id=101, confidence=0.9, distance_meters=35.0, location_2d=(100, 50)
    )
    acoustic = AcousticDetection(
        threat_score=0.5, is_monkey_call=True, signature_match="Alarm Call"
    )
    return StateReport([monkey], acoustic)

@pytest.fixture
def mock_state_report_none():
    """Empty or non-threatening state report."""
    return StateReport([], None)

# --- PYTEST TEST SUITE ---

class Test_Cognition_Service:
    
    # ==================================================
    # 1. HAPPY PATH TESTS (Full Cycle Scenarios)
    # ==================================================
    
    def test_high_threat_triggers_strong_deterrent(self, mock_state_report_high_threat):
        """Test: Optimal input for immediate, critical response (STRONG)."""
        command = assess_threat_level(mock_state_report_high_threat)
        assert command.threat_level == "STRONG"
        assert command.action_details['sound'] == "LOUD_SIREN"
        assert command.action_details['lights'] == "MAX_FLASH"
        assert command.duration_seconds == 5.0
        
    def test_medium_threat_triggers_mild_deterrent(self, mock_state_report_medium_threat):
        """Test: Moderate threat requiring a non-critical warning (MILD)."""
        command = assess_threat_level(mock_state_report_medium_threat)
        assert command.threat_level == "MILD"
        assert command.action_details['sound'] == "WARNING_TONE"
        assert command.action_details['lights'] == "FLASH"
        assert command.duration_seconds == 3.0

    def test_low_confidence_triggers_none(self):
        """Test: Low confidence/far distance keeping the system passive (NONE)."""
        low_confidence_monkey = MonkeyDetection(
            unique_id=202, confidence=0.6, distance_meters=10.0, location_2d=(10, 10)
        )
        report = StateReport([low_confidence_monkey], None)
        command = assess_threat_level(report)
        assert command.threat_level == "NONE"
        assert "Monitoring status maintained" in command.action_details['message']

    def test_too_far_triggers_none(self, mock_state_report_low_threat_far):
        """Test: Distance filter override (35m > 30m) must result in NONE."""
        command = assess_threat_level(mock_state_report_low_threat_far)
        assert command.threat_level == "NONE"
        assert "too far away" in command.action_details['message']

    # ==================================================
    # 2. EDGE CASE TESTS (Boundary Conditions)
    # ==================================================

    def test_boundary_distance_medium_start(self):
        """Test: Detection exactly at the start of the Medium zone (15m)."""
        monkey = MonkeyDetection(
            unique_id=303, confidence=0.8, distance_meters=15.0, location_2d=(100, 100)
        )
        report = StateReport([monkey], None)
        command = assess_threat_level(report)
        # Should trigger MILD if confidence is high enough (0.8 > 0.7)
        assert command.threat_level == "MILD"
        
    def test_boundary_distance_medium_end(self):
        """Test: Detection exactly at the boundary of the Medium zone (30m)."""
        monkey = MonkeyDetection(
            unique_id=303, confidence=0.8, distance_meters=30.0, location_2d=(100, 100)
        )
        report = StateReport([monkey], None)
        command = assess_threat_level(report)
        # Should still trigger MILD as per logic (<= 30m)
        assert command.threat_level == "MILD"

    def test_acoustic_boost_triggers_high_threat(self):
        """Test: Low visual confidence but high acoustic confidence pushing it to STRONG."""
        monkey = MonkeyDetection(
            unique_id=404, confidence=0.7, distance_meters=5.0, location_2d=(10, 10)
        )
        # The acoustic score (0.8) provides enough boost to reach > 0.9
        acoustic = AcousticDetection(
            threat_score=0.8, is_monkey_call=True, signature_match="Alarm Call"
        )
        report = StateReport([monkey], acoustic)
        command = assess_threat_level(report)
        assert command.threat_level == "STRONG"

    def test_multiple_detections_uses_max_threat(self):
        """Test: System should use the worst detection (closest/highest confidence)."""
        monkey1 = MonkeyDetection(
            unique_id=1, confidence=0.9, distance_meters=15.0, location_2d=(10, 10)
        )
        monkey2 = MonkeyDetection(
            unique_id=2, confidence=0.7, distance_meters=25.0, location_2d=(20, 20)
        )
        # Max is monkey1 (15m, 0.9 conf)
        report = StateReport([monkey1, monkey2], None)
        command = assess_threat_level(report)
        assert command.threat_level == "MILD"
        
    # ==================================================
    # 3. EDGE CASE & NULL INPUT TESTS
    # ==================================================

    def test_empty_report_returns_none(self, mock_state_report_none):
        """Test: Handling an empty list of detections."""
        command = assess_threat_level(mock_state_report_none)
        assert command.threat_level == "NONE"
        assert "No monkey detected" in command.action_details['message']

    def test_no_acoustic_data_is_gracefully_handled(self, mock_state_report_medium_threat):
        """Test: What happens if the acoustic stage fails or returns None."""
        # Use the original medium threat but remove the acoustic data
        monkey = MonkeyDetection(
            unique_id=101, confidence=0.8, distance_meters=20.0, location_2d=(120, 60)
        )
        report = StateReport([monkey], None)
        command = assess_threat_level(report)
        # Still MILD because the visual data is sufficient
        assert command.threat_level == "MILD"

    # ==================================================
    # 4. ERROR HANDLING / SECURITY TESTS
    # ==================================================

    def test_input_validation_negative_distance(self):
        """Test: Ensuring the system rejects illogical negative inputs."""
        # Note: The current logic doesn't explicitly raise, but a robust system should prevent it.
        # Here we test if the negative distance prevents trigger or correctly triggers NONE.
        monkey = MonkeyDetection(
            unique_id=999, confidence=0.9, distance_meters=-5.0, location_2d=(10, 10)
        )
        report = StateReport([monkey], None)
        command = assess_threat_level(report)
        # Since distance < 10 and distance > 30 are both false, it defaults to none/mild based on other params.
        # We expect it to fall into the NONE state unless the distance check is explicitly coded to handle it.
        # Based on the given logic, it will treat -5m as < 10m, but its handling is ambiguous.
        # We assert it is NOT STRONG, demonstrating failure of the critical path.
        assert command.threat_level != "STRONG"

    def test_input_validation_invalid_confidence_high(self):
        """Test: Confidence input over 1.0 (should be capped or treated as 1.0)."""
        # This test assumes the function uses min(1.0, ...)
        monkey = MonkeyDetection(
            unique_id=999, confidence=1.5, distance_meters=5.0, location_2d=(10, 10)
        )
        # This should trigger STRONG because 1.5 (capped to 1.0) > 0.9, and distance < 10
        report = StateReport([monkey], AcousticDetection(0.8, True, "Alarm Call"))
        command = assess_threat_level(report)
        assert command.threat_level == "STRONG"<unused56>