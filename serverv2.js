// Node.js Express OAuth Proxy Server for Salesforce OAuth Callback
// Includes morgan for logging

const express = require("express");
const axios = require("axios");
const morgan = require("morgan");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure logging and body parser
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Replace these with your actual credentials
const CLIENT_ID = "YOUR_SALESFORCE_CLIENT_ID";
const CLIENT_SECRET = "YOUR_SALESFORCE_CLIENT_SECRET";
const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const SCRIPT_REDIRECT_BASE =
  "https://script.google.com/macros/s/YOUR_SCRIPT_EXEC_ID/exec";

// OAuth Callback handler from Salesforce
app.get("/callback", async (req, res) => {
  try {
    const { code, state, scriptId } = req.query;

    if (!code || !scriptId) {
      return res.status(400).send("Missing code or scriptId");
    }

    // Exchange code for access token from Salesforce
    const tokenResponse = await axios.post(TOKEN_URL, null, {
      params: {
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: `https://katman.io/callback?scriptId=${scriptId}`,
      },
    });

    const tokenData = tokenResponse.data;
    console.log("Token Data:", tokenData);

    // Forward token data to Apps Script endpoint
    const appsScriptUrl = `${SCRIPT_REDIRECT_BASE}?scriptId=${scriptId}&access_token=${tokenData.access_token}&refresh_token=${tokenData.refresh_token}&instance_url=${tokenData.instance_url}&state=${state}`;

    // Optionally POST instead of GET
    await axios.get(appsScriptUrl);

    res.send(
      "Authorization and token forwarding successful. You may close this tab."
    );
  } catch (err) {
    console.error("OAuth Callback Error:", err.response?.data || err.message);
    res.status(500).send("OAuth handling failed.");
  }
});

app.listen(PORT, () => {
  console.log(`OAuth Proxy Server listening at http://localhost:${PORT}`);
});
