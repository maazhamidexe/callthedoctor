# 🎯 System Architecture & Flow

## Complete System Overview

This document explains exactly how the entire AI doctor call system works from start to finish.

---

## 🏗️ Architecture Diagram

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│             │         │              │         │             │
│  LangGraph  │────────▶│  MCP Tool    │────────▶│ Node Backend│
│  Workflow   │  (1)    │ (Python)     │  (2)    │  (server.js)│
│             │         │              │         │             │
└─────────────┘         └──────────────┘         └──────┬──────┘
      ▲                                                  │
      │                                                  │(3) WebSocket
      │                                                  │
      │                                                  ▼
      │                                          ┌──────────────┐
      │                                          │              │
      │                                          │ React Doctor │
      │                                          │ UI (App.js)  │
      │                                          │              │
      │                                          └──────┬───────┘
      │                                                 │
      │                                                 │(4) Accept Call
      │                                                 │
      │                                                 ▼
      │                                          ┌──────────────┐
      │                                          │              │
      │                                          │  OpenAI      │
      │                                          │  Realtime    │
      │                                          │  API         │
      │                                          │              │
      │                                          └──────┬───────┘
      │                                                 │
      │                                                 │(5) Voice Dialog
      │                                                 │
      │(7) Appointment                                  │
      │    Confirmed                                    │
      │                                                 ▼
      │                                          ┌──────────────┐
      │                                          │              │
      └──────────────────────────────────────────│   Doctor     │
                                   (6)           │ Confirms &   │
                                                 │  Submits     │
                                                 │              │
                                                 └──────────────┘
```

---

## 🔄 Detailed Flow Breakdown

### Step 1: Patient → LangGraph
```python
# Patient talks to AI
patient_input = "I have a fever and headache for 3 days"

# LangGraph processes and decides to call doctor
state = {
    "patient_name": "Ahmed Khan",
    "symptoms": "Fever, headache, cough",
    "recommended_doctor": "dr_sarah_123"
}
```

### Step 2: LangGraph → MCP Tool
```python
# LangGraph invokes MCP tool
from call_doctor_mcp import CallDoctorTool

tool = CallDoctorTool()
result = tool.execute(
    doctor_id="dr_sarah_123",
    patient_name="Ahmed Khan",
    appointment_type="General Consultation",
    symptoms="Fever, headache, cough for 3 days"
)

# Returns immediately with call_id
# {
#   "success": true,
#   "call_id": "call_1700567890",
#   "message": "Call notification sent to doctor"
# }
```

### Step 3: MCP Tool → Node Backend
```http
POST http://localhost:3001/api/initiate-call
Content-Type: application/json

{
  "doctorId": "dr_sarah_123",
  "patientName": "Ahmed Khan",
  "appointmentType": "General Consultation",
  "symptoms": "Fever, headache, cough for 3 days",
  "callId": "call_1700567890"
}
```

**Backend Processing:**
```javascript
// server.js receives the request
app.post('/api/initiate-call', (req, res) => {
  const { doctorId, patientName, appointmentType, symptoms, callId } = req.body;
  
  // Find doctor's WebSocket connection
  const doctorWs = doctorConnections.get(doctorId);
  
  // Send notification through WebSocket
  doctorWs.send(JSON.stringify({
    type: 'incoming_call',
    callId: callId,
    patientName: patientName,
    appointmentType: appointmentType,
    symptoms: symptoms,
    timestamp: new Date().toISOString()
  }));
  
  // Respond to MCP tool
  res.json({ success: true, callId: callId });
});
```

### Step 4: Node Backend → React UI (WebSocket)
```javascript
// App.js receives WebSocket message
websocket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'incoming_call') {
    // Display incoming call screen
    setIncomingCall({
      callId: data.callId,
      patientName: data.patientName,
      appointmentType: data.appointmentType,
      symptoms: data.symptoms
    });
    
    // Play ringtone
    playRingtone();
  }
};
```

**What Doctor Sees:**
```
┌─────────────────────────────────────┐
│         Incoming Call               │
│                                     │
│  Patient: Ahmed Khan                │
│  Type: General Consultation         │
│  Symptoms: Fever, headache, cough   │
│                                     │
│  [Accept Call]    [Decline]        │
└─────────────────────────────────────┘
```

### Step 5: Doctor Accepts → OpenAI Realtime
```javascript
// Doctor clicks Accept
const acceptCall = () => {
  // Send to backend
  ws.send(JSON.stringify({
    type: 'call_accepted',
    callId: incomingCall.callId
  }));
  
  // Start capturing microphone
  startAudioCapture();
};
```

**Backend Connects to OpenAI:**
```javascript
// server.js
async function initializeRealtimeConnection(callId, doctorWs) {
  // Connect to OpenAI Realtime API
  const realtimeWs = new WebSocket(
    'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    }
  );
  
  // Configure session
  realtimeWs.send(JSON.stringify({
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: 'You are a medical assistant helping schedule an appointment...',
      voice: 'alloy'
    }
  }));
  
  // Bidirectional audio streaming
  // Doctor audio → OpenAI
  // OpenAI audio → Doctor
}
```

### Step 6: Voice Conversation
```
Doctor: "Hello, this is Dr. Sarah"
AI: "Hello Doctor. I'm calling on behalf of Ahmed Khan who has 
     been experiencing fever and headache for 3 days. Can we 
     schedule a consultation?"

Doctor: "Yes, I can see him tomorrow at 2 PM"
AI: "Perfect, tomorrow at 2 PM works well. Would you like to 
     add any notes to this appointment?"

Doctor: "Please note that we should check for viral infection"
AI: "Noted. I'll record that."
```

**Audio Flow:**
```javascript
// React captures doctor's voice
processor.onaudioprocess = (e) => {
  const pcm16 = float32ToPCM16(e.inputBuffer.getChannelData(0));
  const base64Audio = arrayBufferToBase64(pcm16);
  
  // Send to backend
  ws.send(JSON.stringify({
    type: 'audio',
    audio: base64Audio,
    callId: activeCall.callId
  }));
};

// Backend forwards to OpenAI
doctorWs.on('message', (message) => {
  const data = JSON.parse(message);
  if (data.type === 'audio') {
    realtimeWs.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: data.audio
    }));
  }
});

// Backend receives AI response
realtimeWs.on('message', (message) => {
  const data = JSON.parse(message);
  if (data.type === 'response.audio.delta') {
    // Forward to doctor
    doctorWs.send(JSON.stringify({
      type: 'ai_audio',
      audio: data.delta,
      callId: callId
    }));
  }
});

// React plays AI audio
const playAudioChunk = (base64Audio) => {
  // Convert base64 → PCM16 → AudioBuffer
  // Play through Web Audio API
};
```

### Step 7: Doctor Confirms Appointment
```javascript
// Doctor fills form in React UI
setAppointmentForm({
  date: '2025-11-21',
  time: '14:00',
  notes: 'Check for viral infection'
});

// Click Confirm
const confirmAppointment = async () => {
  const appointmentData = {
    callId: activeCall.callId,
    patientName: 'Ahmed Khan',
    doctorName: 'Dr. Sarah',
    appointmentTime: '2025-11-21T14:00:00',
    appointmentType: 'General Consultation',
    notes: 'Check for viral infection'
  };
  
  // Send to backend
  const response = await fetch('http://localhost:3001/api/confirm-appointment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appointmentData)
  });
};
```

### Step 8: Backend → LangGraph Callback
```javascript
// server.js
app.post('/api/confirm-appointment', async (req, res) => {
  const appointmentData = req.body;
  
  // Send to LangGraph callback URL
  await axios.post(LANGGRAPH_CALLBACK_URL, {
    status: 'success',
    patient: appointmentData.patientName,
    doctor: appointmentData.doctorName,
    appointment_time: appointmentData.appointmentTime,
    appointment_type: appointmentData.appointmentType,
    notes: appointmentData.notes,
    call_id: appointmentData.callId
  });
  
  res.json({ success: true });
});
```

### Step 9: LangGraph Receives Confirmation
```python
# Your LangGraph callback endpoint
@app.post("/callback")
async def appointment_callback(data: dict):
    """
    Receives appointment confirmation from doctor call system
    """
    
    # Update workflow state
    appointment_info = {
        "confirmed": True,
        "patient": data["patient"],
        "doctor": data["doctor"],
        "time": data["appointment_time"],
        "type": data["appointment_type"],
        "notes": data["notes"]
    }
    
    # Resume workflow
    workflow.update_state(appointment_info)
    
    # Continue to next node (e.g., send confirmation to patient)
    return {"status": "received"}
```

### Step 10: AI Confirms with Patient
```python
# LangGraph continues workflow
def send_confirmation_to_patient(state):
    patient_message = f"""
    Great news {state['patient']}! Your appointment has been confirmed.
    
    📅 Date & Time: {state['appointment_time']}
    👨‍⚕️ Doctor: {state['doctor']}
    📋 Type: {state['appointment_type']}
    📝 Notes: {state['notes']}
    
    We've sent you a confirmation email. Please arrive 10 minutes early.
    """
    
    return {"patient_response": patient_message}
```

---

## 🔑 Key Components

### 1. **server.js** (Node Backend)
- WebSocket server for real-time communication
- REST API endpoints for call management
- OpenAI Realtime API integration
- Bidirectional audio streaming
- Callback to LangGraph

### 2. **App.js** (React Frontend)
- WebSocket client connection
- Incoming call UI
- Microphone capture (Web Audio API)
- Audio playback
- Appointment form
- Real-time transcript display

### 3. **call_doctor_mcp.py** (MCP Tool)
- Python tool for LangGraph
- HTTP client to Node backend
- Error handling
- Health checks

### 4. **test-call-trigger.js** (Testing)
- Simulates LangGraph/MCP tool
- Automated tests
- Interactive mode
- Health checks

---

## 📊 Data Formats

### Incoming Call Request
```json
{
  "doctorId": "dr_sarah_123",
  "patientName": "Ahmed Khan",
  "appointmentType": "General Consultation",
  "symptoms": "Fever, headache, cough for 3 days",
  "callId": "call_1700567890"
}
```

### Appointment Confirmation
```json
{
  "callId": "call_1700567890",
  "patientName": "Ahmed Khan",
  "doctorName": "Dr. Sarah",
  "appointmentTime": "2025-11-21T14:00:00",
  "appointmentType": "General Consultation",
  "notes": "Check for viral infection"
}
```

### LangGraph Callback
```json
{
  "status": "success",
  "patient": "Ahmed Khan",
  "doctor": "Dr. Sarah",
  "appointment_time": "2025-11-21T14:00:00",
  "appointment_type": "General Consultation",
  "notes": "Check for viral infection",
  "call_id": "call_1700567890"
}
```

---

## 🎯 Success Criteria

✅ **Call Initiated**: Doctor sees incoming call notification  
✅ **Call Connected**: Doctor can hear and speak with AI  
✅ **Natural Conversation**: AI understands and responds appropriately  
✅ **Data Captured**: Appointment details are collected  
✅ **Callback Sent**: LangGraph receives confirmation  
✅ **Workflow Continues**: Patient gets confirmation message

---

## 🚀 Production Enhancements

1. **Authentication**: Add JWT tokens for doctors
2. **Database**: Store appointments in PostgreSQL/MongoDB
3. **Queue System**: Handle multiple concurrent calls
4. **Call Recording**: Save conversations (with consent)
5. **Analytics**: Track call duration, success rate
6. **Notifications**: SMS/Email confirmations
7. **Calendar Integration**: Sync with Google Calendar
8. **Load Balancing**: Multiple backend instances
9. **Error Recovery**: Automatic reconnection
10. **Monitoring**: Datadog, Sentry integration

---

**This is the complete picture of how everything works together! 🎉**
