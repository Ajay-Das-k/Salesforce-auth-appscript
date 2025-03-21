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
    const code = req.query.code;
    const state = req.query.state; // This is the state token from Salesforce

    if (!code || !state) {
      console.error("Authorization code or state missing");
      return res.status(400).send("Authorization code or state missing");
    }

    // Extract scriptId from state (for logging/debugging)
    let scriptId = "";
    if (state.includes("scriptId=")) {
      const match = state.match(/scriptId=([^&]+)/);
      if (match && match[1]) {
        scriptId = decodeURIComponent(match[1]);
      }
    } else {
      scriptId = state; // Fallback: assume state is the scriptId
    }

    if (!scriptId) {
      console.error("Could not extract scriptId from state token");
      return res
        .status(400)
        .send("Could not extract scriptId from state token");
    }

    // Construct the Apps Script callback URL
    const appScriptUrl = `https://script.google.com/macros/d/${scriptId}/usercallback`;
    const redirectUrl = `${appScriptUrl}?code=${encodeURIComponent(
      code
    )}&state=${encodeURIComponent(state)}`;

    console.log("Redirecting to Apps Script URL:", redirectUrl);

    // Redirect to Apps Script
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    res.status(500).send("Error processing OAuth callback");
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
