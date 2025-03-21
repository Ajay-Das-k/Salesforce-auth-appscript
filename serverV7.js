const express = require("express");
const axios = require("axios");
const morgan = require("morgan");
const app = express();
const port = process.env.PORT || 3000;

// Add Morgan middleware for HTTP request logging
app.use(morgan("combined"));

// Salesforce OAuth Configuration
const CLIENT_ID =
  "3MVG9bYGb9rFSjxRGKcqftS.Q4XyGEgKqPBGXj32xT5xpa.NiHWJNJSIUnkuFp5NJKvMIXeUrefkGB1myvxIw";
const CLIENT_SECRET =
  "FB591165951E406DEFE30DAE866241F97144E195CE6157E72EC1D7FAEEBC19C8";
const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const REDIRECT_URI = "https://katman.io/appscript/callback";

// Create a more direct approach using URL parameters instead of form posting
app.get("/appscript/callback", async (req, res) => {
  try {
    // Log incoming request details
    console.log("Received callback with query params:", req.query);

    // Get the authorization code and state from Salesforce
    const code = req.query.code;
    const state = req.query.state;

    if (!code) {
      console.error("Authorization code missing");
      return res.status(400).send("Authorization code missing");
    }

    // Extract scriptId from state token
    let scriptId = "";
    try {
      if (state) {
        console.log("Full state parameter:", state);

        // The state is a more complex token created by Apps Script
        // Try to parse the scriptId from the state URL
        if (state.includes("scriptId=")) {
          const match = state.match(/scriptId=([^&]+)/);
          if (match && match[1]) {
            scriptId = decodeURIComponent(match[1]);
            console.log("Extracted scriptId from state parameter:", scriptId);
          }
        } else if (state.includes("=")) {
          // Try to parse as URL query params
          const params = new URLSearchParams(state);
          scriptId = params.get("scriptId");
          if (scriptId) {
            console.log("Extracted scriptId from URLSearchParams:", scriptId);
          }
        } else {
          // If it doesn't contain a scripdId= part and doesn't look like
          // URL parameters, assume the state itself is the scriptId
          scriptId = state;
          console.log("Using state directly as scriptId:", scriptId);
        }

        if (!scriptId) {
          console.error("Could not extract scriptId from state token");
          return res
            .status(400)
            .send("Could not extract scriptId from state token");
        }
      } else {
        console.error("State parameter missing");
        return res.status(400).send("State parameter missing");
      }
    } catch (error) {
      console.error("Error extracting scriptId:", error);
      return res.status(500).send(`
        <h2>Error Extracting Script ID</h2>
        <p>Could not extract the Script ID from the state parameter.</p>
        <p>State parameter: ${state}</p>
        <p>Error: ${error.message}</p>
      `);
    }

    // Construct the Apps Script callback URL
    const appScriptUrl = `https://script.google.com/macros/d/${scriptId}/usercallback`;

    // Pass the authorization code and state to Apps Script
    const redirectUrl = `${appScriptUrl}?code=${encodeURIComponent(
      code
    )}&state=${encodeURIComponent(state)}`;

    console.log("Redirecting to Apps Script URL:", redirectUrl);

    // Show debug info before redirecting
    res.send(`
      <html>
      <head>
        <title>Redirecting to Google Apps Script</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
          .success { color: green; }
          button { padding: 10px; background: #4285f4; color: white; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>Authentication Successful!</h2>
        <p class="success">✓ Ready to connect to Google Apps Script</p>
        <p>Click the button below to continue:</p>
        
        <p><button onclick="window.location.href='${redirectUrl}'">Continue to Google Apps Script</button></p>
        
        <h3>Debug Information:</h3>
        <p>Script ID: ${scriptId}</p>
        <p>State Token: ${state}</p>
        
        <details>
          <summary>View Full Redirect URL</summary>
          <pre>${redirectUrl}</pre>
        </details>
        
        <script>
          // Automatically redirect after 5 seconds
          setTimeout(function() {
            window.location.href = '${redirectUrl}';
          }, 5000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    let errorDetails = "No additional details available";

    if (error.response) {
      errorDetails = `Status: ${error.response.status}, Data: ${JSON.stringify(
        error.response.data
      )}`;
      console.error("Response error details:", errorDetails);
    }

    res.status(500).send(`
      <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .error { color: red; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h2 class="error">Error Processing OAuth Callback</h2>
        <p>${error.message}</p>
        
        <details>
          <summary>Technical Details</summary>
          <pre>${errorDetails}</pre>
        </details>
      </body>
      </html>
    `);
  }
});

// Debug endpoint to help understand state token structure
app.get("/debug-state", (req, res) => {
  const state = req.query.state;
  if (!state) {
    return res.send("<h1>No state parameter provided</h1>");
  }

  // Try to parse as URL params
  let paramsObj = {};
  try {
    if (state.includes("=")) {
      const parts = state.split("&");
      parts.forEach((part) => {
        const [key, value] = part.split("=");
        if (key && value) paramsObj[key] = decodeURIComponent(value);
      });
    }
  } catch (e) {
    paramsObj = { error: e.message };
  }

  res.send(`
    <h1>State Token Debug</h1>
    <p><strong>State:</strong> ${state}</p>
    <p><strong>Length:</strong> ${state.length}</p>
    <p><strong>URL Decoded:</strong> ${decodeURIComponent(state)}</p>
    <p><strong>Contains "scriptId=":</strong> ${state.includes("scriptId=")}</p>
    <p><strong>Contains "=":</strong> ${state.includes("=")}</p>
    
    <h2>Parsed As URL Parameters:</h2>
    <pre>${JSON.stringify(paramsObj, null, 2)}</pre>
    
    <h2>First Attempt Match:</h2>
    <pre>${JSON.stringify(state.match(/scriptId=([^&]+)/), null, 2)}</pre>
  `);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("Server is running");
});

// Start the server
app.listen(port, () => {
  console.log(`Salesforce OAuth server listening on port ${port}`);
  console.log(`Callback URL: ${REDIRECT_URI}`);
});
