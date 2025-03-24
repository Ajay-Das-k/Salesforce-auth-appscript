const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Salesforce OAuth Configuration - ideally store these in environment variables
 var CLIENT_ID =
   "3MVG9bYGb9rFSjxRGKcqftS.Q4XyGEgKqPBGXj32xT5xpa.NiHWJNJSIUnkuFp5NJKvMIXeUrefkGB1myvxIw";
 var CLIENT_SECRET =
   "FB591165951E406DEFE30DAE866241F97144E195CE6157E72EC1D7FAEEBC19C8";
const REDIRECT_URI = "https://katman.io/appscript/callback";
const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
//Hardcoded script ID - update this to your script ID
const DEFAULT_SCRIPT_ID = '1YD1P-VSHKRRvD9kGFWi3m01QczOF-fYK9qByVVEC-vWRmW4Mw-ViBVYS'

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Routes
app.get('/', (req, res) => {
  res.send('Salesforce OAuth Proxy Server is running!');
});

/**
 * Main callback endpoint for Salesforce OAuth
 */
app.get('/appscript/callback', async (req, res) => {
  try {
    // Get the authorization code and state from the URL
    const code = req.query.code;
    const state = req.query.state;
    
    if (!code) {
      return res.status(400).send('Authorization code is missing');
    }
    
    console.log('Received code:', code);
    console.log('Received state:', state);

    // Try to extract the scriptId from the state
    let scriptId = DEFAULT_SCRIPT_ID;
    let extractionMethod = 'default';
    
    // Method 1: Look for a scriptId parameter in the state
    if (state && state.includes('scriptId')) {
      const scriptIdMatch = state.match(/scriptId=([^&]+)/i);
      if (scriptIdMatch && scriptIdMatch[1]) {
        scriptId = scriptIdMatch[1];
        extractionMethod = 'regex';
      }
    }
    
    // Log the script ID and how we got it
    console.log(`Using script ID: ${scriptId} (extraction method: ${extractionMethod})`);

    // Exchange the code for access tokens
    const tokenResponse = await axios({
      method: 'post',
      url: TOKEN_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      }).toString()
    });
    
    const tokenData = tokenResponse.data;
    console.log('Received token data:', JSON.stringify(tokenData, null, 2));

    // Try multiple URL formats for Google Apps Script
    // Option 1: Using the deployed web app URL format
    const scriptCallbackUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
    
    // Build the redirect URL with token data
    const params = new URLSearchParams({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      instance_url: tokenData.instance_url,
      id: tokenData.id,
      issued_at: tokenData.issued_at,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      callback: 'true' // Add a parameter to indicate this is a callback
    });
    
    // Add code and state parameters to preserve the original OAuth flow
    if (code) params.append('code', code);
    if (state) params.append('state', state);
    
    const redirectUrl = `${scriptCallbackUrl}?${params.toString()}`;
    
    console.log('Redirecting to:', redirectUrl);
    
    // Redirect directly to the Apps Script
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in callback:', error);
   const errorMsg = (error.response && error.response.data) || error.message;

    return res.status(500).send(`Error processing authentication: ${errorMsg}`);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;