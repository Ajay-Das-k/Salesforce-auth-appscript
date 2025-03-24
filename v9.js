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
    
    // Instead of trying to parse the complex state token,
    // we'll use a direct approach by redirecting to a temporary page
    // that will extract the scriptId from the Apps Script state token
    
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
    
    // Create an HTML page that will extract the scriptId and redirect
    // This method works with complex state tokens without needing to parse them on the server
    const bridgeHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Processing Authorization</title>
        <script>
          // We're using this page to bridge between Salesforce and Google Apps Script
          // by extracting the scriptId from the state parameter
          
          window.onload = function() {
            try {
              // The state parameter is in the URL
              const urlParams = new URLSearchParams(window.location.search);
              const state = urlParams.get('state');
              
              // Function to safely parse a URL parameter
              function getParameterByName(name, url) {
                if (!url) url = window.location.href;
                name = name.replace(/[\\[\\]]/g, '\\\\$&');
                var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
                    results = regex.exec(url);
                if (!results) return null;
                if (!results[2]) return '';
                return decodeURIComponent(results[2].replace(/\\+/g, ' '));
              }
              
              // Extract scriptId directly from URL if present
              let scriptId = getParameterByName('scriptId') || '';
              
              // If not present in URL, try to extract from state
              if (!scriptId && state) {
                // Try to decode if it looks like a URL parameter
                if (state.includes('scriptId')) {
                  const stateParams = new URLSearchParams(state);
                  scriptId = stateParams.get('scriptId');
                }
                
                // If still not found, use regex to extract
                if (!scriptId) {
                  const scriptIdMatch = state.match(/scriptId=([^&]+)/);
                  if (scriptIdMatch && scriptIdMatch[1]) {
                    scriptId = scriptIdMatch[1];
                  }
                }
              }
              
              if (!scriptId) {
                // Last resort: Use a hardcoded scriptId
                // This should be replaced with your actual script ID
                scriptId = '14Q43XAnzcPTXLEU-ahx1WN6o7lyJ7h9k8rzTXp0s45udi80W9g39631P';
                console.log('Using hardcoded scriptId as fallback');
              }
              
              console.log('Extracted scriptId:', scriptId);
              
              // Get the token data from our server's response
              const accessToken = "${tokenData.access_token}";
              const refreshToken = "${tokenData.refresh_token}";
              const instanceUrl = "${tokenData.instance_url}";
              
              // Construct the callback URL to the Google Apps Script
              const scriptCallbackUrl = 'https://script.google.com/macros/s/' + scriptId + '/exec';
              
              // Redirect to the Apps Script with token data
              const redirectUrl = scriptCallbackUrl + '?' + new URLSearchParams({
                access_token: accessToken,
                refresh_token: refreshToken,
                instance_url: instanceUrl,
                scriptId: scriptId
              }).toString();
              
              console.log('Redirecting to:', redirectUrl);
              window.location.href = redirectUrl;
            } catch (error) {
              document.body.innerHTML = '<h1>Error</h1><p>An error occurred: ' + error.message + '</p>';
              console.error('Error:', error);
            }
          };
        </script>
      </head>
      <body>
        <h1>Processing Your Authorization</h1>
        <p>Please wait while we redirect you back to Google Apps Script...</p>
      </body>
      </html>
    `;
    
    // Send the bridge HTML page
    res.send(bridgeHtml);
    
  } catch (error) {
    console.error('Error in callback:', error);
    const errorMsg = error.response?.data || error.message;
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