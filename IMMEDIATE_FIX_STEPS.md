# 🔧 Immediate Fix Steps for Connection Issues

## Problem
Your frontend on Vercel (`https://callthedoctor.vercel.app/`) cannot maintain connection to your backend on AWS (`https://13.232.77.201.nip.io/`).

## Root Cause
The frontend (HTTPS) is trying to use insecure WebSocket (`ws://`) instead of secure WebSocket (`wss://`). Modern browsers block this mixed content.

## ✅ Code Fixes Applied
1. ✅ Frontend now auto-detects WebSocket protocol (ws/wss)
2. ✅ Backend CORS now allows Vercel origin
3. ✅ Better error logging added

## 🚨 Action Required: Configure Environment Variables

### On Vercel (Frontend)

1. Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

2. Add/Update these variables:
   ```
   REACT_APP_API_URL=https://13.232.77.201.nip.io
   REACT_APP_WS_URL=wss://13.232.77.201.nip.io
   ```
   
   **Important:**
   - Use `https://` (not `http://`) for API_URL
   - Use `wss://` (not `ws://`) for WS_URL
   - No trailing slashes

3. **Redeploy** your Vercel app after setting variables (click "Redeploy" or push a new commit)

### On AWS Server (Backend)

Set these environment variables:

```bash
FRONTEND_URL=https://callthedoctor.vercel.app
PORT=3001
OPENAI_API_KEY=your_key_here
```

**Important:** `FRONTEND_URL` must exactly match your Vercel URL (no trailing slash).

### Verify AWS Server Supports WSS

Your AWS server needs to support secure WebSocket connections. Check:

1. **If using Nginx:** Ensure your config has WebSocket upgrade headers (see `DEPLOYMENT_FIX.md`)
2. **If using AWS ALB:** It should handle WSS automatically
3. **Test WSS connection:** Use a WebSocket client or browser console

## 🔍 Verify the Fix

1. **Check browser console** - should see:
   - ✅ "Connected to server"
   - ✅ "📨 Received: registration_confirmed"
   - ✅ Connection stays open (no immediate disconnects)

2. **Check for errors:**
   - ❌ No "Mixed Content" errors
   - ❌ No "CORS" errors
   - ❌ No "WebSocket connection failed" errors

## 📋 Quick Checklist

- [ ] Set `REACT_APP_API_URL=https://13.232.77.201.nip.io` on Vercel
- [ ] Set `REACT_APP_WS_URL=wss://13.232.77.201.nip.io` on Vercel
- [ ] Redeploy Vercel app
- [ ] Set `FRONTEND_URL=https://callthedoctor.vercel.app` on AWS server
- [ ] Verify AWS server supports WSS (check Nginx/ALB config)
- [ ] Test connection in browser

## 🆘 Still Not Working?

1. Check Vercel deployment logs for errors
2. Check AWS server logs for incoming requests
3. Open browser DevTools → Network → WS tab to see WebSocket connection details
4. Test backend endpoint: `curl https://13.232.77.201.nip.io/health`

For detailed troubleshooting, see `DEPLOYMENT_FIX.md`.

