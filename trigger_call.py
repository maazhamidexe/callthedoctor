#!/usr/bin/env python3
"""
Simple script to trigger a doctor call via the Node.js backend.
This simulates what LangGraph would do when calling the MCP tool.
"""

import requests
import json
import sys

# Backend URL
BACKEND_URL = "http://localhost:3001"

def trigger_call(doctor_id, doctor_name, patient_id, patient_name, symptoms=None):
    """
    Trigger a call to a doctor on behalf of a patient.
    
    Args:
        doctor_id: ID of the doctor to call (e.g., '184')
        doctor_name: Name of the doctor (e.g., 'Akbar Niazi')
        patient_id: ID of the patient (e.g., '3')
        patient_name: Name of the patient
        symptoms: JSON string of symptoms (optional)
    
    Returns:
        dict: Response from the server
    """
    
    endpoint = f"{BACKEND_URL}/api/initiate-call"
    
    payload = {
        "doctorId": doctor_id,
        "doctorName": doctor_name,
        "patientId": patient_id,
        "patientName": patient_name
    }
    
    # Add symptoms if provided
    if symptoms:
        payload["symptoms"] = symptoms
    
    print(f"\n📞 Triggering call to {doctor_name} (ID: {doctor_id})")
    print(f"   Patient: {patient_name} (ID: {patient_id})")
    print(f"   Endpoint: {endpoint}")
    print(f"   Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}\n")
    
    try:
        response = requests.post(endpoint, json=payload, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success!")
            print(f"   Call ID: {result.get('callId')}")
            print(f"   Message: {result.get('message')}")
            return result
        else:
            error_data = response.json()
            print(f"❌ Error: {response.status_code}")
            print(f"   {error_data.get('error')}")
            if 'availableDoctors' in error_data:
                print(f"   Available doctors: {error_data['availableDoctors']}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend server")
        print("   Make sure the server is running: node server.js")
        return None
    except requests.exceptions.Timeout:
        print("❌ Error: Request timed out")
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return None

def check_server_health():
    """Check if the server is running and get connected doctors."""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Server is running")
            print(f"   Connected doctors: {data.get('connectedDoctors', 0)}")
            if data.get('doctors'):
                print(f"   Doctor IDs: {', '.join(data['doctors'])}")
            return data
        return None
    except:
        print("❌ Server is not reachable")
        return None

if __name__ == "__main__":
    print("=" * 60)
    print("Doctor Call Trigger - Python Script")
    print("=" * 60)
    
    # Check server health first
    health = check_server_health()
    
    if not health:
        print("\n💡 Start the server with: node server.js")
        sys.exit(1)
    
    print()
    
    # Example call with default values
    # You can modify these or pass them as command-line arguments
    
    DOCTOR_ID = "184"  # Testing with doctor ID 184
    DOCTOR_NAME = "Akbar Niazi"
    PATIENT_ID = "3"  # Testing with patient ID 3
    PATIENT_NAME = "Hamza Amin"
    
    # Allow command-line arguments
    if len(sys.argv) >= 5:
        DOCTOR_ID = sys.argv[1]
        DOCTOR_NAME = sys.argv[2]
        PATIENT_ID = sys.argv[3]
        PATIENT_NAME = sys.argv[4]
    elif len(sys.argv) > 1:
        print("Usage: python trigger_call.py [doctor_id] [doctor_name] [patient_id] [patient_name]")
        print(f"\nUsing default values...")
    
    # Trigger the call
    result = trigger_call(
        doctor_id=DOCTOR_ID,
        doctor_name=DOCTOR_NAME,
        patient_id=PATIENT_ID,
        patient_name=PATIENT_NAME  # Use the variable, not hardcoded value
    )
    
    if result:
        print("\n✅ Call triggered successfully!")
        print("   Check the React frontend to see the incoming call notification")
    else:
        print("\n❌ Failed to trigger call")
        sys.exit(1)
    
    print("\n" + "=" * 60)
