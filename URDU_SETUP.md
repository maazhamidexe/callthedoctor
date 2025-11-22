# Urdu AI Appointment System - Setup Complete ✅

## Overview
Your AI system now makes **outbound calls in Urdu** on behalf of patients to schedule appointments with clinics. The AI calls the clinic, speaks in Urdu, schedules the appointment, and returns structured data to the server.

## What Changed

### 1. AI Behavior (server.js)
- **Language**: AI now speaks ONLY in Urdu (اردو)
- **Role**: AI calls as a patient representative (not responding to doctor)
- **Instructions**: Comprehensive Urdu script for greeting clinic, describing symptoms, and confirming appointments
- **Patient Context**: Passes patient name, symptoms, and appointment type to AI

### 2. Appointment Extraction (server.js)
- **New Endpoint**: `/api/extract-appointment`
- **AI Processing**: Uses GPT-4o to extract structured JSON from conversation transcript
- **Extracted Fields**:
  ```json
  {
    "appointment_confirmed": true/false,
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "doctor_name": "string",
    "patient_name": "string",
    "appointment_type": "string",
    "notes": "string"
  }
  ```
- **Auto-callback**: Automatically sends confirmed appointments to LangGraph

### 3. Frontend Updates (App.js)
- Passes patient information to token endpoint
- Removed initial greeting (AI starts conversation)
- Collects complete conversation transcript
- Automatically extracts appointment on call end
- Shows appointment confirmation alert

## How It Works

### Flow:
```
1. LangGraph → MCP Tool → Node Backend
   ↓
2. Node sends call notification to React UI
   ↓
3. Doctor accepts call → Request ephemeral token (with patient info)
   ↓
4. AI connects via WebRTC → Starts speaking in Urdu
   ↓
5. AI: "السلام علیکم، میں احمد خان کی طرف سے فون کر رہا ہوں..."
   ↓
6. Doctor responds in Urdu → Conversation continues
   ↓
7. Appointment confirmed → AI says "شکریہ، ملاقات کی تصدیق ہو گئی"
   ↓
8. Call ends → Transcript sent to extraction endpoint
   ↓
9. GPT-4o extracts structured JSON
   ↓
10. Node sends to LangGraph callback
```

## Testing

### Quick Test:
```bash
# Terminal 1 - Start server
node server.js

# Terminal 2 - Open React app (in doctor-ui folder)
npm start

# Terminal 3 - Trigger test call
node test-call-trigger.js --quick
```

### What to Expect:
1. ✅ Browser shows incoming call with patient: "احمد خان"
2. ✅ Accept call → Microphone permission
3. ✅ AI starts speaking in Urdu automatically
4. ✅ Respond in Urdu to schedule appointment
5. ✅ End call → Alert shows extracted appointment details
6. ✅ Check server logs for LangGraph callback

### Example AI Greeting (Urdu):
```
"السلام علیکم، میں احمد خان کی طرف سے فون کر رہا ہوں۔ 
انہیں بخار، سر درد اور کھانسی تین دن سے ہے۔ 
کیا آپ جلد سے جلد ملاقات کا وقت دے سکتے ہیں؟"
```

Translation: "Peace be upon you, I am calling on behalf of Ahmed Khan. They have fever, headache and cough for three days. Can you give the earliest appointment time?"

## API Endpoints

### POST /api/get-ephemeral-token
**Request:**
```json
{
  "patientName": "احمد خان",
  "symptoms": "بخار، سر درد",
  "appointmentType": "عام معائنہ"
}
```

**Response:**
```json
{
  "success": true,
  "client_secret": {
    "value": "eph_key_..."
  }
}
```

### POST /api/extract-appointment
**Request:**
```json
{
  "callId": "call_123",
  "transcript": [
    {"speaker": "AI", "text": "السلام علیکم..."},
    {"speaker": "Doctor", "text": "وعلیکم السلام..."}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "appointment_confirmed": true,
    "date": "2025-11-21",
    "time": "14:00",
    "doctor_name": "Dr. Sarah",
    "patient_name": "احمد خان",
    "appointment_type": "عام معائنہ",
    "notes": "Patient prefers afternoon"
  }
}
```

## Troubleshooting

### AI Not Speaking in Urdu?
- Check server logs for token generation
- Verify OpenAI API key has Realtime API access
- Check browser console for WebRTC connection status

### Appointment Not Extracted?
- Check transcript in browser console
- Verify conversation contains appointment details
- Check server logs for extraction errors

### No Audio?
- Ensure microphone permissions granted
- Check browser console for audio element logs
- Verify WebRTC connection established

## Console Logs to Monitor

### Server:
```
🔑 Generating ephemeral token for WebRTC...
✅ Ephemeral token generated successfully
🤖 === EXTRACTING APPOINTMENT DETAILS ===
✅ Extracted appointment data: {...}
📤 Sending confirmed appointment to LangGraph...
```

### Browser:
```
✅ Ephemeral token received
🎤 Microphone connected
📡 Data channel opened - AI will start speaking in Urdu
🔊 Received audio track from OpenAI
✅ Audio playback started
🤖 AI said: السلام علیکم...
👨‍⚕️ Doctor said: وعلیکم السلام...
```

## Next Steps

1. **Refresh Browser**: Reload http://localhost:3000 to load updated code
2. **Test Call**: Run `node test-call-trigger.js --quick`
3. **Accept Call**: Click "Accept Call" in browser
4. **Speak in Urdu**: Respond to AI in Urdu
5. **End Call**: Click "End Call" to see extraction

## Files Modified
- ✅ `server.js` - Urdu instructions + extraction endpoint
- ✅ `doctor-ui/src/App.js` - Patient context + transcript collection
- ✅ `test-call-trigger.js` - Urdu test data

---

**Status**: 🟢 System Ready
**Language**: 🇵🇰 Urdu (اردو)
**AI Model**: gpt-4o-realtime-preview-2024-12-17
**Extraction Model**: gpt-4o (with JSON mode)
