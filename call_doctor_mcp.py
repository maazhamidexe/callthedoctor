"""
MCP Tool Example for Doctor Call Integration

This is an example of how to create an MCP tool that integrates with
the Node.js doctor call system. Use this in your LangGraph workflow.

Installation:
    pip install mcp requests

Usage in LangGraph:
    from call_doctor_mcp import CallDoctorTool
    
    tool = CallDoctorTool()
    result = await tool.execute(
        doctor_id="dr_sarah_123",
        patient_name="Ahmed Khan",
        appointment_type="General Consultation",
        symptoms="Fever and headache for 3 days"
    )
"""

import requests
from datetime import datetime
from typing import Optional, Dict, Any
import json


class CallDoctorTool:
    """
    MCP Tool to initiate a call with a doctor through the Node.js backend.
    
    This tool:
    1. Sends a request to the Node backend to notify the doctor
    2. The doctor's React UI shows an incoming call
    3. Doctor accepts and talks with OpenAI Realtime AI
    4. Doctor confirms appointment details
    5. Node backend sends appointment data to LangGraph callback URL
    """
    
    name = "call_doctor"
    description = """
    Call a doctor to schedule an appointment. The doctor will receive a notification
    in their interface and can speak with an AI assistant to finalize the appointment.
    Once the doctor confirms, appointment details will be returned.
    """
    
    def __init__(self, backend_url: str = "http://localhost:3001"):
        """
        Initialize the tool.
        
        Args:
            backend_url: URL of the Node.js backend server
        """
        self.backend_url = backend_url
        self.initiate_endpoint = f"{backend_url}/api/initiate-call"
        
    def execute(
        self,
        doctor_id: str,
        patient_name: str,
        appointment_type: str,
        symptoms: str,
        call_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute the tool to call a doctor.
        
        Args:
            doctor_id: Unique identifier for the doctor (e.g., "dr_sarah_123")
            patient_name: Name of the patient
            appointment_type: Type of appointment (e.g., "General Consultation")
            symptoms: Patient's symptoms description
            call_id: Optional unique call ID (auto-generated if not provided)
            
        Returns:
            Dict containing:
                - success: bool
                - call_id: str
                - message: str
                - error: str (if failed)
                
        Example:
            >>> tool = CallDoctorTool()
            >>> result = tool.execute(
            ...     doctor_id="dr_sarah_123",
            ...     patient_name="Ahmed Khan",
            ...     appointment_type="General Consultation",
            ...     symptoms="Fever, headache, and cough for 3 days"
            ... )
            >>> print(result)
            {
                "success": True,
                "call_id": "call_1700123456",
                "message": "Call notification sent to doctor"
            }
        """
        
        # Generate call ID if not provided
        if not call_id:
            call_id = f"call_{int(datetime.now().timestamp())}"
        
        # Prepare request payload
        payload = {
            "doctorId": doctor_id,
            "patientName": patient_name,
            "appointmentType": appointment_type,
            "symptoms": symptoms,
            "callId": call_id
        }
        
        try:
            # Send request to backend
            response = requests.post(
                self.initiate_endpoint,
                json=payload,
                timeout=10
            )
            
            # Check if request was successful
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "call_id": data.get("callId", call_id),
                    "message": data.get("message", "Call initiated successfully"),
                    "doctor_id": doctor_id,
                    "patient_name": patient_name
                }
            
            elif response.status_code == 404:
                # Doctor not connected
                error_data = response.json()
                available_doctors = error_data.get("availableDoctors", [])
                
                return {
                    "success": False,
                    "error": "Doctor not connected to the system",
                    "available_doctors": available_doctors,
                    "doctor_id": doctor_id
                }
            
            else:
                # Other error
                return {
                    "success": False,
                    "error": f"Failed to initiate call: HTTP {response.status_code}",
                    "doctor_id": doctor_id
                }
                
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "Cannot connect to doctor call backend. Is the server running?",
                "backend_url": self.backend_url
            }
            
        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "Request to backend timed out",
                "doctor_id": doctor_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "doctor_id": doctor_id
            }
    
    def check_health(self) -> Dict[str, Any]:
        """
        Check if the backend server is running and get connected doctors.
        
        Returns:
            Dict containing server health information
        """
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=5)
            if response.status_code == 200:
                return {
                    "success": True,
                    "data": response.json()
                }
            else:
                return {
                    "success": False,
                    "error": f"Health check failed: HTTP {response.status_code}"
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Cannot reach backend: {str(e)}"
            }
    
    def get_connected_doctors(self) -> Dict[str, Any]:
        """
        Get list of currently connected doctors.
        
        Returns:
            Dict containing list of connected doctor IDs
        """
        try:
            response = requests.get(f"{self.backend_url}/api/doctors", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "doctors": data.get("connectedDoctors", []),
                    "count": data.get("count", 0)
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to get doctors: HTTP {response.status_code}"
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Cannot reach backend: {str(e)}"
            }


# Example usage
if __name__ == "__main__":
    # Initialize the tool
    tool = CallDoctorTool()
    
    # Check server health
    print("🔍 Checking backend health...")
    health = tool.check_health()
    print(json.dumps(health, indent=2))
    
    # Get connected doctors
    print("\n👥 Getting connected doctors...")
    doctors = tool.get_connected_doctors()
    print(json.dumps(doctors, indent=2))
    
    # Initiate a call (if doctors are connected)
    if doctors.get("success") and doctors.get("count", 0) > 0:
        doctor_id = doctors["doctors"][0]
        print(f"\n📞 Initiating call to {doctor_id}...")
        
        result = tool.execute(
            doctor_id=doctor_id,
            patient_name="Ahmed Khan",
            appointment_type="General Consultation",
            symptoms="Fever, headache, and cough for 3 days"
        )
        
        print(json.dumps(result, indent=2))
        
        if result.get("success"):
            print(f"\n✅ Call initiated successfully!")
            print(f"   Call ID: {result['call_id']}")
            print(f"   Check the doctor's browser - they should see an incoming call!")
        else:
            print(f"\n❌ Call failed: {result.get('error')}")
    else:
        print("\n⚠️ No doctors connected. Start the React frontend first.")
