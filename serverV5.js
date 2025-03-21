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

    // Extract scriptId from state
    let scriptId = "";
    try {
      if (state) {
        // Assuming the state parameter is the scriptId itself
        scriptId = state;

        // If the state parameter contains more information, you might need to parse it
        // For example, if the state is a JSON string, you can parse it like this:
        // const stateObj = JSON.parse(state);
        // scriptId = stateObj.scriptId;
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

    // Simply pass the authorization code and state to Apps Script
    const redirectUrl = `${appScriptUrl}?code=${encodeURIComponent(
      code
    )}&state=${encodeURIComponent(state)}`;

    console.log("Redirecting to Apps Script URL:", appScriptUrl);

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
