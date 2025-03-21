const express = require("express");
const axios = require("axios");
const morgan = require("morgan");
const app = express();
const port = process.env.PORT || 3000;

// Add Morgan middleware for HTTP request logging
// Using the 'combined' format which includes details like IP address, date, method, status code
app.use(morgan("combined"));

// For more detailed logging during development, you can use the 'dev' format instead:
// app.use(morgan('dev'));

// Salesforce OAuth Configuration
const CLIENT_ID =
  "3MVG9bYGb9rFSjxRGKcqftS.Q4XyGEgKqPBGXj32xT5xpa.NiHWJNJSIUnkuFp5NJKvMIXeUrefkGB1myvxIw";
const CLIENT_SECRET =
  "FB591165951E406DEFE30DAE866241F97144E195CE6157E72EC1D7FAEEBC19C8";
const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const REDIRECT_URI = "https://katman.io/appscript/callback";

// Make sure our route matches the REDIRECT_URI path
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
      // The state parameter is a token that includes the scriptId
      // We need to decode it or extract the scriptId

      // If the scriptId is directly available in the state parameter:
      if (req.query.scriptId) {
        scriptId = req.query.scriptId;
      }
      // Otherwise we assume it's embedded in the state token
      else {
        // The exact extraction method depends on your state token format
        scriptId = state.split("=").pop();
        console.log("Extracted scriptId from state token:", scriptId);
      }
    } catch (error) {
      console.error("Error extracting scriptId:", error);
      return res.status(500).send("Error extracting scriptId from state token");
    }

    // Add scriptId to token data
    tokenData.scriptId = scriptId;

    // Construct the Apps Script callback URL
    const appScriptUrl = `https://script.google.com/macros/d/${scriptId}/exec`;
    console.log("Redirecting to Apps Script URL:", appScriptUrl);

    // Create an HTML page that posts the token data to Apps Script
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting to Google Apps Script</title>
        <script>
          // Function to send data to Apps Script
          function sendTokenData() {
            const tokenData = ${JSON.stringify(tokenData)};
            console.log('Sending token data to Apps Script');
            
            // Create a form to post the data
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '${appScriptUrl}';
            
            // Add token data as hidden inputs
            for (const key in tokenData) {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = tokenData[key];
              form.appendChild(input);
            }
            
            // Add a specific parameter to indicate this is coming from our Node server
            const sourceInput = document.createElement('input');
            sourceInput.type = 'hidden';
            sourceInput.name = 'source';
            sourceInput.value = 'node_oauth_server';
            form.appendChild(sourceInput);
            
            // Submit the form
            document.body.appendChild(form);
            form.submit();
          }
          
          // Call the function when the page loads
          window.onload = sendTokenData;
        </script>
      </head>
      <body>
        <h3>Authorization successful!</h3>
        <p>Redirecting to Google Apps Script...</p>
      </body>
      </html>
    `;

    // Send the HTML response
    res.send(html);
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    console.error(
      "Error details:",
      error.response ? error.response.data : "No response data"
    );
    res.status(500).send(`Error processing OAuth callback: ${error.message}`);
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
