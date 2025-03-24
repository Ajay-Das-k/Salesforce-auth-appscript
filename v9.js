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
app.get("/", (req, res) => {
  res.send("Salesforce OAuth Proxy Server is running!");
});

/**
 * Main callback endpoint for Salesforce OAuth
 */
app.get("/appscript/callback", async (req, res) => {
  try {
    // Get the authorization code and state from the URL
    const code = req.query.code;
    const state = req.query.state;

    if (!code) {
      return res.status(400).send("Authorization code is missing");
    }

    console.log("Received code:", code);
    console.log("Received state:", state);

    // Parse the state token to extract the script ID
    // Apps Script state tokens are complex and encoded
    // We need to extract the scriptId parameter from it

    // This is a simplified approach - you may need to adjust based on actual token format
    let scriptId;
    try {
      // The state token from Apps Script is URL-safe base64 encoded with additional data
      // This is a simplified approach to extract the scriptId
      const stateData = decodeStateToken(state);
      scriptId = stateData.scriptId;
      console.log("Extracted scriptId:", scriptId);

      if (!scriptId) {
        throw new Error("Script ID not found in state token");
      }
    } catch (err) {
      console.error("Error parsing state token:", err);
      return res.status(400).send("Invalid state token");
    }

    // Exchange the code for access tokens
    const tokenResponse = await axios({
      method: "post",
      url: TOKEN_URL,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    const tokenData = tokenResponse.data;
    console.log("Received token data:", JSON.stringify(tokenData, null, 2));

    // Construct the callback URL to the Google Apps Script
    const scriptCallbackUrl = `https://script.google.com/macros/s/${scriptId}/exec`;

    // Add token data as query parameters
    const callbackUrl =
      `${scriptCallbackUrl}?` +
      new URLSearchParams({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        instance_url: tokenData.instance_url,
        scriptId: scriptId,
      }).toString();

    console.log("Redirecting to:", callbackUrl);

    // Redirect back to the Google Apps Script with the token data
    return res.redirect(callbackUrl);
  } catch (error) {
    console.error("Error in callback:", error);
    const errorMsg = (error.response && error.response.data) || error.message;
    return res.status(500).send(`Error processing authentication: ${errorMsg}`);
  }
});

/**
 * Function to decode the state token from Apps Script
 * This is a placeholder implementation - you'll need to adapt based on how Apps Script formats the state token
 */
function decodeStateToken(stateToken) {
  // This is a simplified implementation
  // In reality, Apps Script state tokens are more complex
  // You might need to use a more robust parsing approach

  try {
    // For simple testing, if the state token appears to be URL encoded JSON
    if (stateToken.startsWith("%7B")) {
      return JSON.parse(decodeURIComponent(stateToken));
    }

    // Try base64 decoding if it looks like base64
    const base64Regex = /^[A-Za-z0-9_-]+$/;
    if (base64Regex.test(stateToken)) {
      const decoded = Buffer.from(stateToken, "base64").toString();
      if (decoded.includes("scriptId")) {
        // Extract scriptId using regex or JSON parsing if possible
        const match = /scriptId[=:]([^&"]+)/g.exec(decoded);
        if (match && match[1]) {
          return { scriptId: match[1] };
        }
      }
    }

    // If the token contains "scriptId=" directly (simplified case)
    if (stateToken.includes("scriptId=")) {
      const parts = stateToken.split("&");
      for (const part of parts) {
        if (part.startsWith("scriptId=")) {
          return { scriptId: part.split("=")[1] };
        }
      }
    }

    // Fall back to a default approach - try to extract scriptId parameter
    // This is just a simple implementation example
    const scriptIdRegex = /scriptId=([^&]+)/;
    const match = scriptIdRegex.exec(stateToken);
    if (match && match[1]) {
      return { scriptId: match[1] };
    }

    throw new Error("Could not parse state token");
  } catch (err) {
    console.error("Error decoding state token:", err);
    throw new Error("Invalid state token format");
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

module.exports = app;
