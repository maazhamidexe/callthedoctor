# Environment Variables Setup Guide

This guide explains how to configure environment variables for both the server (backend) and doctor-ui (frontend) when deploying separately.

## Server (Backend) Environment Variables

Create a `.env` file in the root directory (`callingagent-node/.env`) with the following variables:

```env
# Server Configuration
PORT=3001

# OpenAI Configuration (Required)
OPENAI_API_KEY=your_openai_api_key_here

# LangGraph Callback URL (for Python backend)
LANGGRAPH_CALLBACK_URL=http://localhost:8000/callback

# Supabase Configuration (Optional - for appointments database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Frontend URL (for CORS) - IMPORTANT: Set to your deployed frontend URL
FRONTEND_URL=http://localhost:3000
```

### Server Deployment Example

When deploying to production, set these in your hosting platform's environment variables:

- **Railway/Render/Heroku**: Set these in your project's environment variables section
- **Docker**: Use `-e` flags or an env file
- **Vercel/Netlify Functions**: Set in project settings

**Important**: Set `FRONTEND_URL` to your actual frontend deployment URL, e.g.:
```env
FRONTEND_URL=https://your-doctor-ui.vercel.app
```

---

## Doctor-UI (Frontend) Environment Variables

Create a `.env` file in the `doctor-ui` directory (`callingagent-node/doctor-ui/.env`) with the following variables:

```env
# React App Environment Variables
# Note: All React environment variables must be prefixed with REACT_APP_

# Backend Server URL (WebSocket and HTTP API)
REACT_APP_API_URL=http://localhost:3001

# WebSocket URL (can be different from API URL if needed)
REACT_APP_WS_URL=ws://localhost:3001
```

### Frontend Deployment Example

When deploying to production:

**For Vercel/Netlify:**
1. Go to your project settings
2. Navigate to Environment Variables
3. Add each variable:
   - `REACT_APP_API_URL` = `https://your-backend-server.com`
   - `REACT_APP_WS_URL` = `wss://your-backend-server.com` (note: `wss://` for secure WebSocket)

**Important**: 
- Use `https://` for HTTP URLs in production
- Use `wss://` (not `ws://`) for WebSocket URLs in production
- After setting environment variables, rebuild/redeploy your frontend

**Example for production:**
```env
REACT_APP_API_URL=https://callingagent-backend.railway.app
REACT_APP_WS_URL=wss://callingagent-backend.railway.app
```

---

## Quick Setup

1. **Copy the example files:**
   ```bash
   # In root directory
   cp .env.example .env
   
   # In doctor-ui directory
   cd doctor-ui
   cp .env.example .env
   ```

2. **Edit `.env` files** with your actual values

3. **For the server:**
   - Set `FRONTEND_URL` to where your frontend will be deployed
   - Set `OPENAI_API_KEY` with your OpenAI API key

4. **For the frontend:**
   - Set `REACT_APP_API_URL` to where your backend will be deployed
   - Set `REACT_APP_WS_URL` to the WebSocket URL (use `wss://` for HTTPS)

---

## Testing Locally

### Backend
```bash
npm install
npm start
# Server runs on http://localhost:3001
```

### Frontend
```bash
cd doctor-ui
npm install
npm start
# Frontend runs on http://localhost:3000
```

Make sure your `.env` files match:
- Server `FRONTEND_URL` = `http://localhost:3000`
- Frontend `REACT_APP_API_URL` = `http://localhost:3001`
- Frontend `REACT_APP_WS_URL` = `ws://localhost:3001`

---

## Security Notes

- **Never commit `.env` files** to version control
- `.env.example` files are safe to commit (they don't contain secrets)
- Use your hosting platform's environment variable features for production
- For WebSocket connections in production, ensure your server supports WSS (secure WebSocket)

---

## Troubleshooting

### CORS Errors
- Make sure `FRONTEND_URL` in server `.env` matches your actual frontend URL
- Check that the server is allowing requests from the frontend origin

### WebSocket Connection Failed
- Verify `REACT_APP_WS_URL` uses the correct protocol (`ws://` for local, `wss://` for production)
- Ensure your hosting platform supports WebSocket connections
- Check that the server is running and accessible

### Environment Variables Not Loading (React)
- React environment variables must be prefixed with `REACT_APP_`
- After changing `.env` files, restart the development server
- For production builds, rebuild after setting environment variables

