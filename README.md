# 🏥 AI Doctor Call System

A complete end-to-end system that connects patients with doctors through AI-powered realtime voice calls, enabling seamless appointment scheduling integrated with LangGraph workflows.

## 🌟 Overview

This system simulates and manages the entire flow from patient symptom reporting to confirmed doctor appointments:

1. **Patient → AI**: Patient describes symptoms to your LangGraph AI
2. **AI → MCP Tool**: LangGraph triggers the MCP tool to call the doctor
3. **MCP → Node Backend**: Tool sends request to Node server
4. **Node → React UI**: Server notifies doctor's screen (incoming call)
5. **Doctor Accepts**: React UI connects to OpenAI Realtime API
6. **Realtime Conversation**: Doctor speaks with AI to schedule appointment
7. **Appointment Confirmed**: Doctor finalizes details in React UI
8. **React → Node → LangGraph**: Appointment JSON sent back to workflow

## 📁 Project Structure

```
callingagent-node/
├── server.js                 # Node.js backend server
├── test-call-trigger.js      # Testing utility
├── package.json              # Node dependencies
└── doctor-ui/                # React frontend
    ├── src/
    │   ├── App.js           # Main React component
    │   ├── App.css          # Styles
    │   └── index.js         # Entry point
    └── package.json         # React dependencies
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+)
- npm or yarn
- OpenAI API key (for Realtime API)

### Installation

1. **Install Backend Dependencies**
```powershell
npm install
```

2. **Install Frontend Dependencies**
```powershell
cd doctor-ui
npm install
```

### Configuration

Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
LANGGRAPH_CALLBACK_URL=http://localhost:8000/callback
PORT=3001
```

### Running the System

1. **Start the Node Backend** (Terminal 1)
```powershell
node server.js
```

Expected output:
```
🚀 Doctor Call Server Starting...
📝 Configuration:
   - Port: 3001
   - LangGraph Callback: http://localhost:8000/callback
   - OpenAI API Key: ✅ Set

✅ Server running successfully!
🌐 HTTP Server: http://localhost:3001
🔌 WebSocket Server: ws://localhost:3001
```

2. **Start the React Frontend** (Terminal 2)
```powershell
cd doctor-ui
npm start
```

The doctor interface will open at `http://localhost:3000`

3. **Test the System** (Terminal 3)
```powershell
node test-call-trigger.js
```

## 🔄 Complete Flow Explanation

### Step 1: Patient Reports Symptoms
```
Patient → LangGraph AI
"I have a fever and headache for 3 days"
```

### Step 2: LangGraph Triggers MCP Tool
```python
# In your LangGraph workflow
result = await call_doctor_tool({
    "doctor_id": "dr_sarah_123",
    "patient_name": "Ahmed Khan",
    "appointment_type": "General Consultation",
    "symptoms": "Fever, headache, and cough for 3 days"
})
```

### Step 3: MCP Tool Calls Node Backend
```python
# Your MCP tool implementation
response = requests.post('http://localhost:3001/api/initiate-call', {
    "doctorId": "dr_sarah_123",
    "patientName": "Ahmed Khan",
    "appointmentType": "General Consultation",
    "symptoms": "Fever, headache, and cough for 3 days",
    "callId": "call_123456"
})
```

### Step 4: Doctor Sees Incoming Call
The React UI displays:
- Patient name
- Appointment type
- Symptoms
- Accept/Decline buttons

### Step 5: Doctor Accepts & Talks with AI
- WebSocket connection to OpenAI Realtime API established
- Bidirectional audio streaming
- AI acts as medical assistant scheduling the appointment
- Doctor can speak naturally: "I can see the patient tomorrow at 2 PM"

### Step 6: Doctor Confirms Appointment
React form captures:
- Date
- Time
- Notes

### Step 7: Data Sent Back to LangGraph
```json
POST http://localhost:8000/callback
{
  "status": "success",
  "patient": "Ahmed Khan",
  "doctor": "Dr. Sarah",
  "appointment_time": "2025-11-21T14:00:00",
  "appointment_type": "General Consultation",
  "notes": "Patient prefers afternoon appointments",
  "call_id": "call_123456"
}
```

## 🛠️ API Endpoints

### Backend Server (Port 3001)

#### `POST /api/initiate-call`
Trigger an incoming call to a doctor.

**Request:**
```json
{
  "doctorId": "dr_sarah_123",
  "patientName": "Ahmed Khan",
  "appointmentType": "General Consultation",
  "symptoms": "Fever and headache",
  "callId": "call_123456"
}
```

**Response:**
```json
{
  "success": true,
  "callId": "call_123456",
  "message": "Call notification sent to doctor"
}
```

#### `POST /api/confirm-appointment`
Confirm appointment and send to LangGraph.

**Request:**
```json
{
  "callId": "call_123456",
  "patientName": "Ahmed Khan",
  "doctorName": "Dr. Sarah",
  "appointmentTime": "2025-11-21T14:00:00",
  "appointmentType": "General Consultation",
  "notes": "Follow-up needed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment confirmed and sent to workflow"
}
```

#### `POST /api/reject-call`
Reject an incoming call.

**Request:**
```json
{
  "callId": "call_123456",
  "reason": "Doctor unavailable"
}
```

#### `GET /api/doctors`
List connected doctors.

**Response:**
```json
{
  "connectedDoctors": ["dr_sarah_123", "dr_john_456"],
  "count": 2
}
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "connectedDoctors": 1,
  "activeRealtimeCalls": 0,
  "doctors": ["dr_sarah_123"]
}
```

## 🧪 Testing

### Automated Tests

Run the complete test suite:
```powershell
node test-call-trigger.js
```

Options:
- `--quick` - Quick test with one call
- `--interactive` - Enter custom call data
- `--health` - Check server health
- `--wait` - Wait for doctor to connect
- `--help` - Show all options

### Manual Testing

1. Open React UI: `http://localhost:3000`
2. Open browser DevTools console
3. Look for "Connected to server" message
4. Run: `node test-call-trigger.js`
5. Accept the call in the browser
6. Speak or fill the appointment form
7. Click "Confirm Appointment"
8. Check all console logs

## 🔌 WebSocket Messages

### Frontend → Backend

**Register Doctor:**
```json
{
  "type": "register",
  "doctorId": "dr_sarah_123"
}
```

**Call Accepted:**
```json
{
  "type": "call_accepted",
  "callId": "call_123456"
}
```

**Audio Data:**
```json
{
  "type": "audio",
  "audio": "base64_encoded_pcm16_audio",
  "callId": "call_123456"
}
```

**Call Ended:**
```json
{
  "type": "call_ended",
  "callId": "call_123456"
}
```

### Backend → Frontend

**Incoming Call:**
```json
{
  "type": "incoming_call",
  "callId": "call_123456",
  "patientName": "Ahmed Khan",
  "appointmentType": "General Consultation",
  "symptoms": "Fever and headache",
  "timestamp": "2025-11-20T10:30:00Z"
}
```

**AI Audio Response:**
```json
{
  "type": "ai_audio",
  "audio": "base64_encoded_pcm16_audio",
  "callId": "call_123456"
}
```

**AI Transcript:**
```json
{
  "type": "ai_transcript",
  "text": "I understand, would 2 PM work?",
  "callId": "call_123456"
}
```

## 🎯 Integration with LangGraph

### MCP Tool Definition

```python
from mcp import Tool
import requests

class CallDoctorTool(Tool):
    name = "call_doctor"
    description = "Call a doctor to schedule an appointment"
    
    async def execute(self, doctor_id: str, patient_name: str, 
                     appointment_type: str, symptoms: str):
        response = requests.post(
            'http://localhost:3001/api/initiate-call',
            json={
                "doctorId": doctor_id,
                "patientName": patient_name,
                "appointmentType": appointment_type,
                "symptoms": symptoms,
                "callId": f"call_{datetime.now().timestamp()}"
            }
        )
        
        # Wait for callback from doctor
        # Your LangGraph workflow will receive the appointment data
        # at your callback endpoint
        
        return response.json()
```

### LangGraph Workflow Example

```python
from langgraph.graph import StateGraph

class AppointmentState(TypedDict):
    patient_name: str
    symptoms: str
    doctor_id: str
    appointment_confirmed: bool
    appointment_time: Optional[str]

def call_doctor_node(state: AppointmentState):
    # Trigger the call
    tool_result = call_doctor_tool.execute(
        doctor_id=state["doctor_id"],
        patient_name=state["patient_name"],
        appointment_type="Consultation",
        symptoms=state["symptoms"]
    )
    
    # Workflow pauses here and waits for callback
    return state

# When appointment is confirmed, your callback endpoint receives:
@app.post("/callback")
def appointment_callback(data: dict):
    # Resume the workflow with appointment data
    graph.update_state({
        "appointment_confirmed": True,
        "appointment_time": data["appointment_time"],
        "doctor_name": data["doctor"]
    })
    
    # Continue to next node
    return {"status": "received"}
```

## 🐛 Troubleshooting

### Issue: "Doctor not connected"

**Solution:**
1. Make sure React app is running
2. Open `http://localhost:3000` in browser
3. Check browser console for "Connected to server"
4. Wait 2-3 seconds for WebSocket to establish
5. Run test again

### Issue: "OpenAI API key not set"

**Solution:**
1. Create `.env` file in root directory
2. Add: `OPENAI_API_KEY=sk-your-key-here`
3. Restart the server

### Issue: "No audio during call"

**Solution:**
1. Check browser microphone permissions
2. Use HTTPS in production (required for getUserMedia)
3. Check browser DevTools console for errors
4. Verify OpenAI Realtime API access

### Issue: "LangGraph callback fails"

**Solution:**
1. This is normal for testing (LangGraph not running)
2. Set correct callback URL in `.env`
3. Ensure your LangGraph server is running
4. Check LangGraph logs for incoming requests

## 📝 Production Checklist

- [ ] Use HTTPS for all connections
- [ ] Implement proper authentication for doctors
- [ ] Add database to store appointments
- [ ] Implement retry logic for failed callbacks
- [ ] Add monitoring and logging (Winston, etc.)
- [ ] Use environment-specific configs
- [ ] Implement rate limiting
- [ ] Add comprehensive error handling
- [ ] Use Redis for WebSocket session management
- [ ] Add call recording (with consent)
- [ ] Implement call quality monitoring

## 🔒 Security Considerations

1. **Authentication**: Add JWT tokens for doctor authentication
2. **HTTPS**: Use SSL/TLS in production
3. **API Keys**: Never commit `.env` files
4. **CORS**: Configure proper CORS policies
5. **Rate Limiting**: Prevent abuse of API endpoints
6. **Input Validation**: Validate all incoming data
7. **WebSocket Security**: Implement WS authentication

## 📚 Technologies Used

- **Backend**: Node.js, Express, WebSocket
- **Frontend**: React, Lucide Icons
- **AI**: OpenAI Realtime API
- **Workflow**: LangGraph (MCP integration)
- **Audio**: Web Audio API, PCM16 encoding

## 📄 License

MIT

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review server and browser console logs
3. Test with `node test-call-trigger.js --health`

---

**Built with ❤️ for seamless AI-powered healthcare scheduling**
