# Deployment Connection Issues - Fix Guide

## Problem Summary

Your frontend (deployed on Vercel at `https://callthedoctor.vercel.app/`) cannot connect to your backend (deployed on AWS at `https://13.232.77.201.nip.io/`).

### Root Causes

1. **Mixed Protocol Issue**: HTTPS frontend trying to use `ws://` (insecure WebSocket) instead of `wss://` (secure WebSocket)
2. **CORS Configuration**: Backend may not be allowing requests from Vercel origin
3. **WebSocket Upgrade**: AWS server needs proper SSL/WSS support

## ✅ Solutions Applied

### 1. Frontend Auto-Detection (Already Fixed)

The frontend code now automatically detects whether to use `ws://` or `wss://` based on:
- Environment variable `REACT_APP_WS_URL` (if explicitly set)
- The protocol of `REACT_APP_API_URL`
- Current page protocol (HTTPS → WSS, HTTP → WS)

### 2. Backend CORS Updates (Already Fixed)

The server now allows multiple origins including:
- Your configured `FRONTEND_URL`
- `https://callthedoctor.vercel.app`
- `http://localhost:3000` (for development)

## 🔧 Required Configuration Steps

### Step 1: Configure Vercel Environment Variables

Go to your Vercel project settings → Environment Variables and set:

```
REACT_APP_API_URL=https://13.232.77.201.nip.io
REACT_APP_WS_URL=wss://13.232.77.201.nip.io
```

**Important Notes:**
- Use `https://` for API URL (not `http://`)
- Use `wss://` for WebSocket URL (not `ws://`)
- After setting these, **rebuild and redeploy** your Vercel app

### Step 2: Configure AWS Backend Environment Variables

On your AWS server, ensure these environment variables are set:

```bash
FRONTEND_URL=https://callthedoctor.vercel.app
PORT=3001
OPENAI_API_KEY=your_openai_key_here
```

**Important**: The `FRONTEND_URL` must exactly match your Vercel URL.

### Step 3: Verify AWS Server SSL/WSS Setup

Your AWS server at `https://13.232.77.201.nip.io/` appears to have HTTPS enabled. For WebSocket connections to work, you need to ensure:

#### Option A: Using Nginx as Reverse Proxy (Recommended)

If you're using Nginx, ensure your configuration includes WebSocket upgrade:

```nginx
server {
    listen 443 ssl http2;
    server_name 13.232.77.201.nip.io;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-lived WebSocket connections
        proxy_read_timeout 86400;
    }
}
```

#### Option B: Using AWS Application Load Balancer (ALB)

If using ALB:
1. Ensure your target group health checks are configured
2. ALB automatically handles WebSocket upgrades
3. Ensure security groups allow traffic on port 443

#### Option C: Direct HTTPS in Node.js (Not Recommended)

If running Node.js with HTTPS directly, you'll need to update `server.js` to use HTTPS. This is more complex and less common.

### Step 4: Test the Connection

1. **Test HTTPS endpoint:**
   ```bash
   curl https://13.232.77.201.nip.io/health
   ```
   Should return: `{"status":"ok",...}`

2. **Test WebSocket manually:**
   ```bash
   wscat -c wss://13.232.77.201.nip.io
   ```
   Or use a WebSocket testing tool like [websocket.org/echo.html](https://www.websocket.org/echo.html)

3. **Check Vercel logs** after redeploying to see connection attempts

## 🔍 Troubleshooting

### Issue: Still getting connection errors after setup

1. **Check browser console** for specific error messages
2. **Verify environment variables** are set correctly on Vercel
3. **Check AWS server logs** for incoming connection attempts
4. **Test WebSocket endpoint** directly using a WebSocket client

### Issue: "WebSocket connection failed"

**Possible causes:**
- Server doesn't support WSS (check if Nginx/ALB is configured)
- Firewall blocking WebSocket traffic
- Certificate issues (WSS requires valid SSL certificate)

**Solutions:**
- Ensure SSL certificate is valid and not expired
- Check AWS security groups allow inbound on port 443
- Verify reverse proxy (if using) is configured for WebSocket upgrade

### Issue: "CORS error"

**Possible causes:**
- `FRONTEND_URL` doesn't exactly match Vercel URL
- Missing `https://` in the URL

**Solutions:**
- Double-check `FRONTEND_URL=https://callthedoctor.vercel.app` (no trailing slash)
- Check server logs to see what origin is being blocked

### Issue: Connection opens then immediately closes

This is what you're seeing in your logs. **Likely causes:**
- Protocol mismatch (using `ws://` instead of `wss://`)
- Reverse proxy not handling WebSocket upgrade properly
- Server crashing or rejecting the connection

**Solutions:**
- Ensure `REACT_APP_WS_URL=wss://13.232.77.201.nip.io` (with `wss://`)
- Check server logs for errors
- Verify reverse proxy configuration includes WebSocket upgrade headers

## 📝 Quick Checklist

- [ ] Set `REACT_APP_API_URL=https://13.232.77.201.nip.io` on Vercel
- [ ] Set `REACT_APP_WS_URL=wss://13.232.77.201.nip.io` on Vercel
- [ ] Set `FRONTEND_URL=https://callthedoctor.vercel.app` on AWS server
- [ ] Redeploy Vercel app after setting environment variables
- [ ] Verify AWS server has SSL/WSS support configured
- [ ] Check AWS security groups allow inbound on port 443
- [ ] Test HTTPS endpoint: `curl https://13.232.77.201.nip.io/health`
- [ ] Check browser console for new errors after redeploy

## 🚀 After Fixes

Once configured correctly, you should see:
- ✅ "Connected to server" in browser console
- ✅ "📨 Received: registration_confirmed"
- ✅ Connection remains stable (no immediate disconnects)
- ✅ No CORS errors

If you still see connection issues after following all steps, check:
1. AWS CloudWatch logs (if using AWS services)
2. Nginx access/error logs (if using Nginx)
3. Browser Network tab → WS connection details
4. Server console output for incoming WebSocket connections

