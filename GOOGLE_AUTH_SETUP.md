# Google OAuth Setup for KudiSave

## Current Configuration

**Frontend:**
- Client ID: Set in `docs/assets/js/config.js`
- Location: `docs/index.html`

**Backend:**
- Client ID: Set in `backend/.env`
- Location: Backend environment variables

---

## Step 1: Fix Authorized Redirect URIs in Google Cloud Console

1. Go to: **https://console.cloud.google.com/**
2. Select your KudiSave project
3. Go to **APIs & Services → Credentials**
4. Click on your OAuth 2.0 Client ID (Web application)
5. Under **Authorized redirect URIs**, add ALL these URLs:

```
http://localhost:5000
http://localhost/
https://kudisave.com/
https://kudisave.com
https://www.kudisave.com/
https://www.kudisave.com
```

6. Click **Save**

---

## Step 2: Authorized JavaScript Origins

In the same OAuth 2.0 Client ID settings:
- Under **Authorized JavaScript origins**, add:

```
http://localhost:5000
http://localhost
https://kudisave.com
https://www.kudisave.com
```

---

## Step 3: Backend Configuration

**File:** `backend/.env`

Set your Google OAuth credentials (from Google Cloud Console):

```env
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/gmail/callback
```

**Do NOT commit `.env` to GitHub - it's already in `.gitignore`**

---

## Step 4: Frontend Configuration

**File:** `docs/assets/js/config.js`

The Google Client ID should be set globally:

```javascript
window.KUDISAVE_GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
```

This same ID should match what's in `backend/.env`

---

## Step 5: Enable Google Sign-In Library

Make sure this script is in your HTML `<head>`:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

✅ Already in `docs/index.html` line 28

---

## Testing Flow

### Local Testing (http://localhost:5000)

1. Start backend: `cd backend && node server.js`
2. Backend serves frontend from `/docs` folder
3. Visit: `http://localhost:5000`
4. Click "Continue with Google"
5. Should redirect to Google login

### Production Testing (https://kudisave.com) 

1. Make sure GitHub Pages is configured
2. Visit: `https://kudisave.com`
3. CORS should allow the domain
4. Click "Continue with Google"

---

## Troubleshooting

### Error: "invalid_client"
- GOOGLE_CLIENT_ID is wrong or invalid
- Check Google Cloud Console credentials
- Verify it matches in both frontend and backend

### Error: "redirect_uri_mismatch"
- Authorized redirect URIs not in Google Cloud Console
- Follow Step 1 above
- MUST match exactly including protocol (http vs https)

### Error: "Google is not defined"
- Google Sign-In library not loaded
- Check `<script src="https://accounts.google.com/gsi/client"></script>` is in HTML `<head>`
- Wait for script to load before calling signInWithGoogle()

### CORS Issues
- Backend CORS might block the frontend domain
- Check `backend/src/app.js` CORS configuration
- Should allow: `https://kudisave.com`, `https://www.kudisave.com`

### Check Browser Console
Open DevTools (F12) → Console tab and look for:
- ✅ "🔓 Initiating Google Sign-In..." - good start
- ✅ "✅ OAuth2 access token received" - token obtained
- ❌ "❌ Google Sign-In library not loaded" - library issue
- ❌ "❌ No access token from OAuth2" - OAuth flow failed

---

## Current Auth Flow

1. **Frontend** → User clicks "Continue with Google"
2. **Google GSI** → User signs in with Google (popup or redirect)
3. **Google** → Returns credential JWT or access token
4. **Frontend** → Sends credential to `POST /api/v1/auth/google`
5. **Backend** → Verifies credential with Google servers
6. **Backend** → Creates/updates user in database
7. **Backend** → Returns JWT token
8. **Frontend** → Saves token & redirects to dashboard

---

## Getting Your Client ID & Secret

1. Go to: https://console.cloud.google.com/
2. Create a project or select "KudiSave"
3. Go to APIs & Services → Credentials
4. Create OAuth 2.0 Client ID (Web application)
5. Copy the **Client ID** and **Client Secret**
6. Add to `backend/.env` and `docs/assets/js/config.js`

---

## Next Steps

1. ✅ Get Google Client ID and Secret from Google Cloud Console
2. ✅ Update `backend/.env` with credentials
3. ✅ Update `docs/assets/js/config.js` with Client ID
4. ✅ Verify Google Cloud Console has correct redirect URIs
5. ✅ Restart backend to load `.env` variables
6. ✅ Test on http://localhost:5000
7. ✅ Check browser console for debug logs
8. ✅ Push to GitHub/deploy when working

