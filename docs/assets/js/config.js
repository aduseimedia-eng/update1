// KudiSave Configuration
// Smart environment detection

(function() {
  const hostname = window.location.hostname;
  
  // Detect environment
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
  const isFileProtocol = window.location.protocol === 'file:';
  
  // PRODUCTION: Set your deployed backend URL here
  // Example: 'https://kudisave-api.onrender.com/api/v1'
  const PRODUCTION_API_URL = 'https://kudisave-api-production.up.railway.app/api/v1';
  
  // Detect if on local network (private IP ranges)
  const isLocalNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(hostname);

  // Configure API URL
  if (PRODUCTION_API_URL) {
    // Production mode - backend deployed
    window.KUDISAVE_API_URL = PRODUCTION_API_URL;
    console.log('🚀 KudiSave: Production mode');
  } else if (isLocalNetwork) {
    // Local network (mobile device on same WiFi) - use same host IP
    window.KUDISAVE_API_URL = `http://${hostname}:5000/api/v1`;
    console.log('📱 KudiSave: Local network mode');
  } else if (isLocalhost || isFileProtocol) {
    // Local development on same machine
    window.KUDISAVE_API_URL = 'http://localhost:5000/api/v1';
    console.log('💻 KudiSave: Local development mode');
  } else {
    // Fallback - try same host with backend port
    window.KUDISAVE_API_URL = `http://${hostname}:5000/api/v1`;
    console.log('💻 KudiSave: Fallback mode');
  }
  
  // Google OAuth Client ID
  // Replace with your actual Client ID from Google Cloud Console
  // console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client IDs
  window.KUDISAVE_GOOGLE_CLIENT_ID = '760162537864-49c7509k9sdk3hf57d2at16anhv74cul.apps.googleusercontent.com';

  // Log configuration
  console.log('Config:', {
    hostname,
    apiUrl: window.KUDISAVE_API_URL
  });
})();

// ===========================================
// DEPLOYMENT INSTRUCTIONS:
// ===========================================
// 1. Deploy backend to your hosting provider
// 2. Copy your backend URL
// 3. Update PRODUCTION_API_URL above to:
//    'https://YOUR-APP-NAME.onrender.com/api/v1'
// 4. Push to GitHub
// =========================================== 
