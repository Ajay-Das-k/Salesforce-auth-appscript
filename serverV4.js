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

    // Get the authorization code from Salesforce
    const code = req.query.code;
    // Get the state which contains the scriptId
    const state = req.query.state;

    if (!code) {
      console.error("Authorization code missing");
      return res.status(400).send("Authorization code missing");
    }

    console.log("Exchanging authorization code for tokens...");

    // Exchange the code for tokens
    const tokenResponse = await axios.post(TOKEN_URL, null, {
      params: {
        grant_type: "authorization_code",
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      },
    });

    console.log("Token exchange successful");
    const tokenData = tokenResponse.data;

    // Extract scriptId from state
    let scriptId = "";
    try {
      // Check if scriptId is directly in query params
      if (req.query.scriptId) {
        scriptId = req.query.scriptId;
        console.log("Found scriptId in query params:", scriptId);
      }
      // Try to parse from incoming URL structure
      else if (
        req.headers.referer &&
        req.headers.referer.includes("/macros/d/")
      ) {
        const urlParts = req.headers.referer.split("/macros/d/");
        if (urlParts.length > 1) {
          scriptId = urlParts[1].split("/")[0];
          console.log("Extracted scriptId from referer URL:", scriptId);
        }
      }
      // Otherwise extract from state parameter
      else if (state) {
        // The exact extraction depends on your state token format
        // For debugging, log the full state
        console.log("Full state parameter:", state);

        // Try direct extraction if the scriptId appears to be in the state
        if (state.length > 20 && !state.includes("=")) {
          scriptId = state;
          console.log("Using state directly as scriptId:", scriptId);
        } else {
          // Try extracting the scriptId assuming it's the last part of a key=value pair
          scriptId = state.split("=").pop();
          console.log("Extracted scriptId from state as last value:", scriptId);
        }
      }

      // Fallback to user-provided scriptId
      if (!scriptId) {
        // This is a fallback that should be removed once the issue is resolved
        scriptId = "14Q43XAnzcPTXLEU-ahx1WN6o7lyJ7h9k8rzTXp0s45udi80W9g39631P";
        console.log("Using fallback scriptId:", scriptId);
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

    // Add scriptId to token data
    tokenData.scriptId = scriptId;

    // Construct the Apps Script callback URL with the correct format:
    // Using /macros/d/[scriptId]/usercallback as per the example URL
    const appScriptUrl = `https://script.google.com/macros/d/${scriptId}/usercallback`;
    console.log("Redirecting to Apps Script URL:", appScriptUrl);

    // Store all parameters to be sent
    const params = new URLSearchParams();

    // Add all token data
    for (const key in tokenData) {
      params.append(key, tokenData[key]);
    }

    // Add source indicator
    params.append("source", "node_oauth_server");

    // Construct the full redirect URL
    const redirectUrl = `${appScriptUrl}?${params.toString()}`;

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
        <p class="success">✓ Successfully obtained Salesforce tokens</p>
        <p>Click the button below to continue to Google Apps Script:</p>
        
        <p><button onclick="window.location.href='${redirectUrl}'">Continue to Google Apps Script</button></p>
        
        <h3>Debug Information:</h3>
        <p>Script ID: ${scriptId}</p>
        <p>Access Token: ${tokenData.access_token.substring(0, 10)}...</p>
        <p>Instance URL: ${tokenData.instance_url}</p>
        
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
// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("Server is running");
});

// Start the server
app.listen(port, () => {
  console.log(`Salesforce OAuth server listening on port ${port}`);
  console.log(`Callback URL: ${REDIRECT_URI}`);
});
