const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration - must be before CORS setup
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LANGGRAPH_CALLBACK_URL = process.env.LANGGRAPH_CALLBACK_URL || 'http://localhost:8000/callback';
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cpifquoelejdrtlqycsj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwaWZxdW9lbGVqZHJ0bHF5Y3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxODM4NTEsImV4cCI6MjA3Nzc1OTg1MX0.9xJjAStrw9z28lg0GOrFneJs7ckJiYnmzdwS_gz581M';

// CORS configuration - allow requests from frontend URL
// Support multiple origins for flexibility
const allowedOrigins = [
  FRONTEND_URL,
  'https://callthedoctor.vercel.app',
  'http://localhost:3000'
].filter(Boolean); // Remove any undefined/null values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.some(allowed => origin === allowed)) {
      callback(null, true);
    } else {
      // For development, allow all origins; for production, log and reject
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️  Allowing origin in dev mode: ${origin}`);
        callback(null, true);
      } else {
        console.warn(`❌ CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Validation
if (!OPENAI_API_KEY) {
  console.error('⚠️  WARNING: OPENAI_API_KEY not set in environment variables');
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  WARNING: Supabase credentials not fully configured. Appointments will not be saved to database.');
}

// Log configuration on startup
console.log('🔧 Server Configuration:');
console.log(`   Frontend URL: ${FRONTEND_URL}`);
console.log(`   Server Port: ${PORT}`);
console.log(`   LangGraph Callback: ${LANGGRAPH_CALLBACK_URL}`);

// Store active connections
const doctorConnections = new Map();

if (!OPENAI_API_KEY) {
  console.error('⚠️  WARNING: OPENAI_API_KEY not set in environment variables');
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  WARNING: Supabase credentials not fully configured. Appointments will not be saved to database.');
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register') {
        doctorConnections.set(data.doctorId, ws);
        ws.send(JSON.stringify({
          type: 'registration_confirmed',
          doctorId: data.doctorId,
          timestamp: new Date().toISOString()
        }));
      }
      
      if (data.type === 'call_ended') {
        console.log(`Call ended: ${data.callId}`);
      }
    } catch (error) {
      console.error('WebSocket message error:', error.message);
    }
  });
  
  ws.on('close', () => {
    for (const [doctorId, connection] of doctorConnections.entries()) {
      if (connection === ws) {
        doctorConnections.delete(doctorId);
      }
    }
  });
});

// Generate ephemeral token for WebRTC
app.post('/api/get-ephemeral-token', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'OpenAI API key not configured'
    });
  }

  try {
    const { patientName, doctorName } = req.body;
    console.log('🔑 Generating ephemeral token:');
    console.log('   Patient Name:', patientName);
    console.log('   Doctor Name:', doctorName);
    
    // Build instructions with patient and doctor information
    const patientNameForAI = patientName || 'مریض';
    const doctorInfo = doctorName ? `\nDoctor/Clinic: ${doctorName}` : '';
    
    const sessionConfig = {
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "ash",
      instructions: `You are a helpful assistant calling a doctor's clinic. Your goal is to schedule an appointment.

Speak ONLY in Urdu.

Your output must be extremely short, conversational, and sound human.

Use fillers like "umm", "acha", "jee", and "han" to sound natural.

Do not speak in long paragraphs. Speak one sentence at a time and wait for the other person to reply.

Follow this exact conversation flow:

1. Greet and ask if this is the right clinic (Wait for reply).

2. State you want to confirm an appointment for "${patientNameForAI}" (Wait for reply).

3. Negotiate a time. If they suggest a time, repeat it thoughtfully (e.g., "Umm... 5 bajay?") and then agree.

4. Say thanks and bye.

Current Context:

Patient Name: ${patientNameForAI}
${doctorName ? `Doctor/Clinic Name: ${doctorName}` : ''}

One-Shot Example (The "Learning" Part):

[User]: "Hello?"

[Assistant]: "Assalam-o-Alaikum... kya ye ${doctorName || 'doctor'} ka clinic hai?"

[User]: "Walaikum Assalam, jee haan wohi hai."

[Assistant]: "Acha... mujhe ${patientNameForAI} ke liye appointment book karna tha."

[User]: "Theek hai, kab aana chahte hain?"

[Assistant]: "Umm... kya aaj shaam ka time mil sakta hai?"

[User]: "Aaj 6 bajay ajaen."

[Assistant]: "6 bajay... theek hai, ye sahi hai. Shukriya."`
    };

    const response = await axios.post(
      'https://api.openai.com/v1/realtime/sessions',
      sessionConfig,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract client_secret - it might be nested or direct
    let clientSecret = response.data.client_secret;
    
    // Handle case where client_secret might be an object with a value property
    if (clientSecret && typeof clientSecret === 'object' && clientSecret.value) {
      clientSecret = clientSecret.value;
    }
    
    if (!clientSecret) {
      console.error('❌ No client_secret in OpenAI response:', JSON.stringify(response.data, null, 2));
      return res.status(500).json({
        success: false,
        error: 'OpenAI did not return a client_secret'
      });
    }
    
    console.log('✅ Ephemeral token generated (length:', clientSecret.length, ')');
    
    res.json({
      success: true,
      client_secret: clientSecret
    });

  } catch (error) {
    console.error('Token generation failed:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate token',
      details: error.response?.data || error.message
    });
  }
});

// Initiate call - broadcasts to all connected doctors
app.post('/api/initiate-call', async (req, res) => {
  const { doctorId, patientId, doctorName, patientName, appointmentType, symptoms } = req.body;
  
  // Log received data for debugging
  console.log('📞 Received call initiation request:');
  console.log('   Doctor ID:', doctorId);
  console.log('   Doctor Name:', doctorName);
  console.log('   Patient ID:', patientId);
  console.log('   Patient Name:', patientName);
  console.log('   Appointment Type:', appointmentType);
  console.log('   Symptoms:', symptoms);
  
  // Validate required fields
  if (!patientId) {
    return res.status(400).json({
      success: false,
      error: 'patientId is required'
    });
  }
  
  if (!doctorId) {
    return res.status(400).json({
      success: false,
      error: 'doctorId is required'
    });
  }
  
  const callId = `call_${Date.now()}`;
  const now = new Date();
  // Use current date/time as placeholder - will be updated with actual decided date/time after conversation
  // IMPORTANT: These are strings for Supabase string columns
  const appointmentDate = String(now.toISOString().slice(0, 10)); // YYYY-MM-DD format as string
  const appointmentTime = String(now.toTimeString().slice(0, 8)); // HH:MM:SS format as string
  
  // Store appointment to Supabase immediately with patient_id, doctor_id, appointment_date, appointment_time, and status
  // Note: appointment_date and appointment_time are placeholders (current date/time) - will be updated
  // with the actual decided date/time after the conversation extracts it from the transcript
  // This happens regardless of doctor connection status
  // Status defaults to "scheduled" when appointment is created
  let appointmentStored = false;
  let appointmentId = null;
  try {
    const appointment = await insertAppointmentToSupabase({
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: 'scheduled' // Initial status when appointment is created
    });
    console.log('✅ Appointment stored to Supabase');
    appointmentStored = true;
    appointmentId = appointment?.id;
  } catch (error) {
    console.error('⚠️  Failed to store appointment to Supabase:', error.message);
    // Return error if Supabase storage fails - this is critical
    return res.status(500).json({
      success: false,
      error: 'Failed to store appointment to database',
      details: error.message
    });
  }
  
  // Check if any doctors are connected for WebSocket broadcast
  if (doctorConnections.size === 0) {
    console.warn('⚠️  No doctors connected, but appointment stored successfully');
    return res.json({
      success: true,
      callId: callId,
      message: 'Appointment stored, but no doctors connected to notify',
      appointmentStored: appointmentStored
    });
  }
  
  const callData = {
    type: 'incoming_call',
    callId: callId,
    patientId: patientId,
    patientName: patientName || `Patient ${patientId}`,
    doctorId: doctorId,
    doctorName: doctorName || null,
    appointmentType: appointmentType || null,
    symptoms: symptoms || null,
    appointmentId: appointmentId, // Store appointment ID for status updates
    timestamp: new Date().toISOString()
  };
  
  console.log('📤 Broadcasting call data:', JSON.stringify(callData, null, 2));
  
  // Broadcast to all connected doctors
  let sentCount = 0;
  doctorConnections.forEach((ws, id) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(callData));
        sentCount++;
      } catch (error) {
        console.error(`Failed to send to ${id}:`, error.message);
      }
    }
  });
  
  if (sentCount > 0) {
    res.json({
      success: true,
      callId: callData.callId,
      message: `Call sent to ${sentCount} doctor(s)`
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to send notification'
    });
  }
});

// Helper function to find doctor ID by name
async function findDoctorIdByName(doctorName) {
  if (!doctorName || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  
  try {
    const response = await axios.get(
      `${SUPABASE_URL}/rest/v1/doctors?name=ilike.${encodeURIComponent(doctorName)}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.length > 0) {
      return response.data[0].id;
    }
  } catch (error) {
    console.warn(`Could not find doctor by name "${doctorName}":`, error.message);
  }
  return null;
}

// Helper function to find patient ID by name
async function findPatientIdByName(patientName) {
  if (!patientName || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  
  try {
    const response = await axios.get(
      `${SUPABASE_URL}/rest/v1/patients?name=ilike.${encodeURIComponent(patientName)}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.length > 0) {
      return response.data[0].id;
    }
  } catch (error) {
    console.warn(`Could not find patient by name "${patientName}":`, error.message);
  }
  return null;
}

// Helper function to insert appointment into Supabase
// Stores patient_id, doctor_id, appointment_date (YYYY-MM-DD), appointment_time (HH:MM:SS), and status
async function insertAppointmentToSupabase(appointmentData) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️  Supabase not configured, skipping database insert');
    return null;
  }

  try {
    // Extract patient_id and doctor_id directly (they should be provided as strings/numbers)
    let patientId = appointmentData.patient_id || appointmentData.patientId;
    let doctorId = appointmentData.doctor_id || appointmentData.doctorId;
    
    // Convert to integers if they're strings (Supabase might expect integers)
    if (patientId && typeof patientId === 'string') {
      patientId = parseInt(patientId, 10);
      if (isNaN(patientId)) {
        throw new Error(`Invalid patient_id: ${appointmentData.patient_id}`);
      }
    }
    
    if (doctorId && typeof doctorId === 'string') {
      doctorId = parseInt(doctorId, 10);
      if (isNaN(doctorId)) {
        throw new Error(`Invalid doctor_id: ${appointmentData.doctor_id}`);
      }
    }
    
    if (!patientId || !doctorId) {
      throw new Error('Both patient_id and doctor_id are required');
    }
    
    // Extract appointment_date (YYYY-MM-DD) - use provided or current date
    // IMPORTANT: Must be a string for Supabase string column
    let appointmentDate = appointmentData.appointment_date || appointmentData.appointmentDate;
    if (!appointmentDate) {
      // Fallback to current date if not provided
      const now = new Date();
      appointmentDate = now.toISOString().slice(0, 10); // YYYY-MM-DD format as string
    }
    
    // Ensure it's a string
    appointmentDate = String(appointmentDate);
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      throw new Error(`Invalid appointment_date format. Expected YYYY-MM-DD, got: ${appointmentDate}`);
    }
    
    // Extract appointment_time (HH:MM:SS or HH:MM) - use provided or current time
    // IMPORTANT: Must be a string for Supabase string column
    let appointmentTime = appointmentData.appointment_time || appointmentData.appointmentTime;
    if (!appointmentTime) {
      // Fallback to current time if not provided
      const now = new Date();
      appointmentTime = now.toTimeString().slice(0, 8); // HH:MM:SS format as string
    }
    
    // Ensure it's a string
    appointmentTime = String(appointmentTime);
    
    // Normalize time format to HH:MM:SS
    // If only HH:MM is provided, add :00 seconds
    if (/^\d{2}:\d{2}$/.test(appointmentTime)) {
      appointmentTime = appointmentTime + ':00';
    }
    
    // Validate time format (HH:MM:SS)
    if (!/^\d{2}:\d{2}:\d{2}$/.test(appointmentTime)) {
      throw new Error(`Invalid appointment_time format. Expected HH:MM:SS, got: ${appointmentTime}`);
    }

    // Extract status - default to "scheduled" if not provided
    let status = appointmentData.status || 'scheduled';
    
    // Validate status - strictly only "scheduled" or "rejected" allowed
    if (!['scheduled', 'rejected'].includes(status)) {
      console.warn(`⚠️  Invalid status "${status}", defaulting to "scheduled"`);
      status = 'scheduled'; // Force to scheduled if invalid
    }
    
    // Build appointment record with patient_id, doctor_id, appointment_date, appointment_time, and status
    // appointment_date and appointment_time are stored as strings in Supabase
    const appointmentRecord = {
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_date: String(appointmentDate), // Explicitly convert to string
      appointment_time: String(appointmentTime), // Explicitly convert to string
      status: status
    };

    console.log('💾 Storing appointment to Supabase (as strings):', appointmentRecord);
    console.log('   appointment_date type:', typeof appointmentRecord.appointment_date);
    console.log('   appointment_time type:', typeof appointmentRecord.appointment_time);

    const response = await axios.post(
      `${SUPABASE_URL}/rest/v1/appointments`,
      appointmentRecord,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );

    console.log('✅ Appointment saved to Supabase:', response.data[0]?.id);
    return response.data[0];
  } catch (error) {
    console.error('❌ Failed to insert appointment to Supabase:', error.response?.data || error.message);
    throw error;
  }
}

// Extract appointment details from transcript
app.post('/api/extract-appointment', async (req, res) => {
  const { transcript, callId, patientId, doctorId } = req.body;
  
  if (!transcript || transcript.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No transcript provided'
    });
  }

  try {
    const conversationText = transcript.map(msg => 
      `${msg.speaker}: ${msg.text}`
    ).join('\n');
    
    const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const currentYear = new Date().getFullYear();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDateStr = tomorrowDate.toISOString().slice(0, 10);
    
    const extractionPrompt = `Extract appointment details from this conversation between an AI assistant (calling on behalf of a patient) and a doctor/clinic.

Conversation:
${conversationText}

Return ONLY a valid JSON object with these exact fields:
{
  "appointment_confirmed": boolean (true if appointment was successfully scheduled, false otherwise),
  "appointment_date": "YYYY-MM-DD" format (e.g., "${currentDate}") or null if no date mentioned,
  "appointment_time": "HH:MM:SS" format in 24-hour time (e.g., "14:30:00" for 2:30 PM) or null if no time mentioned,
  "doctor_name": string or null,
  "patient_name": string or null,
  "chief_complaint": string (reason for appointment) or null,
  "notes": string (any additional notes from conversation) or null
}

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown, no code blocks, no explanations
2. appointment_confirmed: true ONLY if the appointment was explicitly confirmed/scheduled in the conversation
3. appointment_date: Must be in "YYYY-MM-DD" format. 
   - If conversation mentions "today", use "${currentDate}"
   - If "tomorrow", use "${tomorrowDateStr}"
   - If a specific date is mentioned, use ${currentYear} as the year if year is not specified
   - Format must be exactly YYYY-MM-DD
4. appointment_time: Must be in "HH:MM:SS" format (24-hour). 
   - Convert 12-hour format to 24-hour (e.g., "2:30 PM" → "14:30:00", "10:00 AM" → "10:00:00")
   - Always include seconds (use :00 if not specified)
5. Parse Urdu/English time expressions carefully:
   - "3 bajay" or "3 o'clock" → "15:00:00" (if afternoon/evening context) or "03:00:00" (if morning context)
   - "Dopahar ke 2 bajay" (afternoon 2) → "14:00:00"
   - "Shaam ke 6 bajay" (evening 6) → "18:00:00"
   - "Subah ke 10 bajay" (morning 10) → "10:00:00"
   - Always convert to 24-hour format with seconds
6. If date or time is not mentioned in the conversation, use null for that field
7. Extract chief_complaint from the patient's description of their problem/symptoms mentioned in conversation
8. If appointment_confirmed is false, you can still provide date/time if they were discussed
9. Ensure all time values are in HH:MM:SS format (not HH:MM)

Example valid response:
{
  "appointment_confirmed": true,
  "appointment_date": "${currentDate}",
  "appointment_time": "15:00:00",
  "doctor_name": "Dr. Akbar Niazi",
  "patient_name": "Hamza Amin",
  "chief_complaint": "Cough and fever",
  "notes": "Patient requested evening appointment"
}`;

    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a precise data extraction assistant. Return only valid JSON, no markdown, no explanations.'
          },
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const extractedData = JSON.parse(completion.data.choices[0].message.content);
    
    // Normalize date format - ensure YYYY-MM-DD
    // IMPORTANT: Must be a string for Supabase string column
    let appointmentDate = extractedData.appointment_date || extractedData.date;
    if (appointmentDate) {
      appointmentDate = String(appointmentDate); // Ensure it's a string
      const currentYear = new Date().getFullYear();
      // If date doesn't start with year, try to add current year
      if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
        const dateMatch = appointmentDate.match(/(\d{2})-(\d{2})$/);
        if (dateMatch) {
          appointmentDate = `${currentYear}-${dateMatch[1]}-${dateMatch[2]}`;
        } else {
          const parts = appointmentDate.split('-');
          if (parts.length === 2) {
            appointmentDate = `${currentYear}-${parts[0]}-${parts[1]}`;
          } else if (parts.length === 3 && parts[0].length !== 4) {
            appointmentDate = `${currentYear}-${parts[1]}-${parts[2]}`;
          }
        }
      }
      // Validate final date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
        console.warn(`⚠️  Invalid date format after normalization: ${appointmentDate}`);
        appointmentDate = String(new Date().toISOString().slice(0, 10)); // Fallback to today as string
      }
    } else {
      appointmentDate = null;
    }
    
    // Normalize time format - ensure HH:MM:SS
    // IMPORTANT: Must be a string for Supabase string column
    let appointmentTime = extractedData.appointment_time || extractedData.time;
    if (appointmentTime) {
      appointmentTime = String(appointmentTime); // Ensure it's a string
      // If format is HH:MM, add :00
      if (/^\d{2}:\d{2}$/.test(appointmentTime)) {
        appointmentTime = appointmentTime + ':00';
      }
      // Validate format
      if (!/^\d{2}:\d{2}:\d{2}$/.test(appointmentTime)) {
        console.warn(`⚠️  Invalid time format received: ${appointmentTime}, normalizing...`);
        // Try to parse and reformat
        const timeMatch = appointmentTime.match(/(\d{1,2}):?(\d{2})?/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          // Check if PM/afternoon (assuming 12-hour format)
          if (hours < 12 && (appointmentTime.toLowerCase().includes('pm') || appointmentTime.toLowerCase().includes('bajay'))) {
            hours += 12;
          }
          appointmentTime = String(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
        }
      }
    } else {
      appointmentTime = null;
    }

    // Add callId and full transcript to extracted data
    extractedData.callId = callId;
    extractedData.appointment_date = appointmentDate;
    extractedData.appointment_time = appointmentTime;
    extractedData.full_transcript = conversationText;
    
    // Log extracted data for debugging
    console.log('📊 Extracted appointment data:');
    console.log('   appointment_confirmed:', extractedData.appointment_confirmed);
    console.log('   appointment_date:', appointmentDate);
    console.log('   appointment_time:', appointmentTime);
    console.log('   patientId:', patientId);
    console.log('   doctorId:', doctorId);
    
    // Update existing appointment in Supabase with extracted date/time if confirmed
    if (extractedData.appointment_confirmed && appointmentDate && appointmentTime && patientId && doctorId) {
      try {
        console.log('🔄 Updating appointment in Supabase with extracted date/time...');
        await updateAppointmentDateTime(patientId, doctorId, appointmentDate, appointmentTime);
        console.log('✅ Appointment date/time updated in Supabase from conversation');
      } catch (error) {
        console.error('⚠️  Failed to update appointment date/time in Supabase:', error.message);
        console.error('   Error details:', error.response?.data || error.stack);
        // Continue even if Supabase update fails
      }
    } else {
      if (!extractedData.appointment_confirmed) {
        console.log('ℹ️  Appointment not confirmed, skipping update');
      } else if (!appointmentDate || !appointmentTime) {
        console.warn('⚠️  Appointment confirmed but date/time not extracted. Cannot update appointment.');
        console.warn(`   Date: ${appointmentDate}, Time: ${appointmentTime}`);
      } else if (!patientId || !doctorId) {
        console.warn('⚠️  Appointment confirmed but patientId or doctorId not provided. Cannot update appointment.');
        console.warn(`   patientId: ${patientId}, doctorId: ${doctorId}`);
      }
    }
    
    // Send to LangGraph if confirmed
    if (extractedData.appointment_confirmed) {
      try {
        await axios.post(LANGGRAPH_CALLBACK_URL, {
          status: 'success',
          call_id: callId,
          patient: extractedData.patient_name,
          doctor: extractedData.doctor_name,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          chief_complaint: extractedData.chief_complaint,
          notes: extractedData.notes,
          full_transcript: conversationText
        }, { timeout: 5000 });
      } catch (error) {
        if (error.code !== 'ECONNREFUSED') {
          console.error('LangGraph callback error:', error.message);
        }
      }
    }
    
    // Return response with both appointment_date/appointment_time and date/time for compatibility
    const responseData = {
      ...extractedData,
      // Ensure normalized date/time are in the response
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      // Add aliases for frontend compatibility (use normalized values)
      date: appointmentDate,
      time: appointmentTime
    };
    
    console.log('📤 Sending response with data:', {
      appointment_confirmed: responseData.appointment_confirmed,
      appointment_date: responseData.appointment_date,
      appointment_time: responseData.appointment_time,
      date: responseData.date,
      time: responseData.time
    });
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('Extraction error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to extract appointment details'
    });
  }
});

// Manual appointment confirmation
app.post('/api/confirm-appointment', async (req, res) => {
  const appointmentData = req.body;
  
  try {
    // Save to Supabase
    try {
      await insertAppointmentToSupabase({
        ...appointmentData,
        appointment_confirmed: true,
        doctorName: appointmentData.doctorName,
        patientName: appointmentData.patientName,
        appointmentTime: appointmentData.appointmentTime
      });
    } catch (error) {
      console.error('Failed to save appointment to Supabase:', error.message);
      // Continue even if Supabase insert fails
    }

    // Send to LangGraph callback
    await axios.post(LANGGRAPH_CALLBACK_URL, {
      status: 'success',
      patient: appointmentData.patientName,
      doctor: appointmentData.doctorName,
      appointment_time: appointmentData.appointmentTime,
      appointment_type: appointmentData.appointmentType,
      notes: appointmentData.notes || '',
      call_id: appointmentData.callId
    }, { timeout: 5000 });
    
    res.json({
      success: true,
      message: 'Appointment confirmed'
    });
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      res.json({
        success: true,
        message: 'Appointment confirmed (callback not available)'
      });
    } else {
      console.error('Callback error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to send appointment'
      });
    }
  }
});

// Helper function to update appointment date and time in Supabase
async function updateAppointmentDateTime(patientId, doctorId, appointmentDate, appointmentTime) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️  Supabase not configured, skipping appointment update');
    return null;
  }

  try {
    // Convert to integers if they're strings
    let pid = patientId;
    let did = doctorId;
    if (pid && typeof pid === 'string') {
      pid = parseInt(pid, 10);
    }
    if (did && typeof did === 'string') {
      did = parseInt(did, 10);
    }
    
    if (!pid || !did) {
      throw new Error('Both patient_id and doctor_id are required');
    }
    
    if (!appointmentDate || !appointmentTime) {
      throw new Error('Both appointment_date and appointment_time are required');
    }
    
    // Ensure both are strings for Supabase string columns
    appointmentDate = String(appointmentDate);
    appointmentTime = String(appointmentTime);
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      throw new Error(`Invalid appointment_date format. Expected YYYY-MM-DD, got: ${appointmentDate}`);
    }
    
    // Validate time format
    if (!/^\d{2}:\d{2}:\d{2}$/.test(appointmentTime)) {
      throw new Error(`Invalid appointment_time format. Expected HH:MM:SS, got: ${appointmentTime}`);
    }
    
    // Find the most recent scheduled appointment for this patient and doctor
    const getResponse = await axios.get(
      `${SUPABASE_URL}/rest/v1/appointments`,
      {
        params: {
          patient_id: `eq.${pid}`,
          doctor_id: `eq.${did}`,
          status: 'eq.scheduled',
          order: 'appointment_date.desc,appointment_time.desc',
          limit: 1
        },
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!getResponse.data || getResponse.data.length === 0) {
      console.warn(`⚠️  No scheduled appointment found to update for patient_id: ${pid}, doctor_id: ${did}`);
      return null;
    }
    
    const appointmentId = getResponse.data[0].id;
    
    // Update the appointment with new date and time (as strings)
    const updateResponse = await axios.patch(
      `${SUPABASE_URL}/rest/v1/appointments?id=eq.${appointmentId}`,
      { 
        appointment_date: String(appointmentDate), // Explicitly convert to string
        appointment_time: String(appointmentTime)  // Explicitly convert to string
      },
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );
    
    if (updateResponse.data && updateResponse.data.length > 0) {
      console.log(`✅ Appointment date/time updated for appointment ID: ${appointmentId}`);
      console.log(`   New date: ${appointmentDate}, time: ${appointmentTime}`);
      return updateResponse.data[0];
    } else {
      console.warn(`⚠️  Failed to update appointment ID: ${appointmentId}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to update appointment date/time:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to update appointment status in Supabase
async function updateAppointmentStatus(patientId, doctorId, status) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️  Supabase not configured, skipping status update');
    return null;
  }

  try {
    // Convert to integers if they're strings
    let pid = patientId;
    let did = doctorId;
    if (pid && typeof pid === 'string') {
      pid = parseInt(pid, 10);
    }
    if (did && typeof did === 'string') {
      did = parseInt(did, 10);
    }
    
    if (!pid || !did) {
      throw new Error('Both patient_id and doctor_id are required');
    }
    
    // Validate status - strictly only "scheduled" or "rejected" allowed
    if (!['scheduled', 'rejected'].includes(status)) {
      throw new Error(`Invalid status: ${status}. Status must be either "scheduled" or "rejected"`);
    }
    
    // Use Supabase's update with filter to update the most recent appointment
    // First, get the most recent appointment
    const getResponse = await axios.get(
      `${SUPABASE_URL}/rest/v1/appointments`,
      {
        params: {
          patient_id: `eq.${pid}`,
          doctor_id: `eq.${did}`,
          order: 'appointment_date.desc,appointment_time.desc',
          limit: 1
        },
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!getResponse.data || getResponse.data.length === 0) {
      console.warn(`⚠️  No appointment found to update for patient_id: ${pid}, doctor_id: ${did}`);
      return null;
    }
    
    const appointmentId = getResponse.data[0].id;
    
    // Update the appointment status
    const updateResponse = await axios.patch(
      `${SUPABASE_URL}/rest/v1/appointments?id=eq.${appointmentId}`,
      { status: status },
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );
    
    if (updateResponse.data && updateResponse.data.length > 0) {
      console.log(`✅ Appointment status updated to "${status}" for appointment ID: ${appointmentId}`);
      return updateResponse.data[0];
    } else {
      console.warn(`⚠️  Failed to update appointment ID: ${appointmentId}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to update appointment status:', error.response?.data || error.message);
    throw error;
  }
}

// Reject call
app.post('/api/reject-call', async (req, res) => {
  const { callId, reason, patientId, doctorId } = req.body;
  
  // Update appointment status to "rejected" if patientId and doctorId are provided
  if (patientId && doctorId) {
    try {
      await updateAppointmentStatus(patientId, doctorId, 'rejected');
      console.log('✅ Appointment status updated to "rejected"');
    } catch (error) {
      console.error('⚠️  Failed to update appointment status:', error.message);
      // Continue even if status update fails - don't block the rejection
    }
  } else {
    console.warn('⚠️  patientId and doctorId not provided, skipping status update');
  }
  
  try {
    await axios.post(LANGGRAPH_CALLBACK_URL, {
      status: 'rejected',
      call_id: callId,
      reason: reason || 'Doctor unavailable'
    }, { timeout: 5000 });
    
    res.json({
      success: true,
      message: 'Call rejected'
    });
    
  } catch (error) {
    res.json({
      success: true,
      message: 'Call rejected (callback not available)'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedDoctors: doctorConnections.size,
    openai: !!OPENAI_API_KEY
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`OpenAI API: ${OPENAI_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`LangGraph callback: ${LANGGRAPH_CALLBACK_URL}`);
  console.log(`Supabase: ${SUPABASE_URL && SUPABASE_ANON_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
});
