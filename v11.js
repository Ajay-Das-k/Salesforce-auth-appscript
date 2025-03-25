const express = require("express");
const bodyParser = require("body-parser");

// Create an instance of the Express app
const app = express();

// Middleware to parse incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define the OAuth callback route
app.post("appscript/callback", (req, res) => {
  try {
    // Log the entire request body for debugging
    console.log(
      "Full Callback Request Body:",
      JSON.stringify(req.body, null, 2)
    );

    // Extract key information from the request body
    const {
      source,
      access_token,
      refresh_token,
      instance_url,
      email,
      scriptId,
      id,
      token_type,
      issued_at,
      signature,
      scope,
    } = req.body;

    // Detailed console logging
    console.log("OAuth Callback Received:");
    console.log("-------------------");
    console.log(`Source: ${source}`);
    console.log(`Email: ${email}`);
    console.log(`Script ID: ${scriptId}`);
    console.log(
      `Access Token (first 10 chars): ${access_token?.substring(0, 10)}...`
    );
    console.log(`Instance URL: ${instance_url}`);
    console.log("-------------------");

    // Send a success HTML response
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Salesforce OAuth Authentication</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f2f5;
          }
          .container {
            text-align: center;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          h1 {
            color: #4CAF50;
          }
          p {
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Successful!</h1>
          <p>Your Salesforce account has been successfully connected.</p>
          <p>You can now close this window.</p>
          <script>
            // Optional: Auto-close window after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    // Error handling
    console.error("Error processing OAuth callback:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Error</title>
      </head>
      <body>
        <h1>Authentication Failed</h1>
        <p>An error occurred during the authentication process. Please try again later.</p>
      </body>
      </html>
    `);
  }
});

// Start the server and listen on a specified port
const port = 3000; // You can change the port if necessary
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
