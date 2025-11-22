# 🚀 Quick Start Guide

Get the AI Doctor Call System running in 5 minutes!

## ⚡ Super Quick Start (3 Steps)

### 1️⃣ Install Dependencies

```powershell
# Install backend dependencies
npm install

# Install frontend dependencies
cd doctor-ui
npm install
cd ..
```

### 2️⃣ Configure Environment

Create a `.env` file:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-key-here
LANGGRAPH_CALLBACK_URL=http://localhost:8000/callback
PORT=3001
```

### 3️⃣ Run Everything

**Terminal 1 - Backend:**
```powershell
node server.js
```

**Terminal 2 - Frontend:**
```powershell
cd doctor-ui
npm start
```

**Terminal 3 - Test:**
```powershell
# Wait a few seconds for the React app to load in browser
node test-call-trigger.js
```

## ✅ Verify It's Working

After running the test script, you should see:

### In Terminal 1 (Backend):
```
✅ Server running successfully!
🔌 New WebSocket connection established
✅ Doctor registered: dr_sarah_123
📞 === INCOMING CALL REQUEST ===
```

### In Terminal 3 (Test):
```
✅ Server is running!
✅ 1 doctor(s) connected
✅ Call initiated successfully!
```

### In Browser (http://localhost:3000):
You'll see an incoming call notification with:
- Patient name: Ahmed Khan
- Appointment type: General Consultation
- Accept/Decline buttons

## 🎯 What to Do Next

1. **Accept the Call** - Click the green "Accept Call" button
2. **Allow Microphone** - Browser will ask for microphone permission
3. **Talk or Fill Form** - Either speak with the AI or just fill the appointment form
4. **Confirm Appointment** - Click "Confirm Appointment"
5. **Check Logs** - See appointment data being sent to LangGraph callback

## 🐛 Common Issues

### ❌ "Doctor not connected"
**Fix:** Make sure the React app is running and browser is open at http://localhost:3000

### ❌ "Cannot connect to doctor call backend"
**Fix:** Start the backend server first: `node server.js`

### ❌ "OpenAI API key not set"
**Fix:** Add your API key to `.env` file and restart the server

## 📱 Test Different Scenarios

### Quick Test (One call):
```powershell
node test-call-trigger.js --quick
```

### Interactive Test (Custom data):
```powershell
node test-call-trigger.js --interactive
```

### Health Check:
```powershell
node test-call-trigger.js --health
```

## 🔗 Next Steps

1. ✅ **Integrate with LangGraph** - Use `call_doctor_mcp.py` as your MCP tool
2. ✅ **Customize Doctor UI** - Edit `doctor-ui/src/App.js`
3. ✅ **Add Multiple Doctors** - Change `doctorId` in React app
4. ✅ **Production Setup** - Follow the README.md for deployment

## 💡 Pro Tips

- Keep all 3 terminals open while developing
- Check browser DevTools console for detailed WebSocket logs
- Use `--interactive` mode to test with different patient data
- The system works without LangGraph for testing

## 📚 Full Documentation

See `README.md` for:
- Complete API documentation
- WebSocket message formats
- LangGraph integration examples
- Production deployment guide

---

**Need Help?** Check `README.md` → Troubleshooting section
