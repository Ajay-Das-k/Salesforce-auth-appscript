const express = require("express");
const app = express();


app.use(express.json());


// Store user sessions temporarily in memory
const userSessions = {};

const CLIENT_ID =
  "3MVG9bYGb9rFSjxRGKcqftS.Q4b0eBnnvww7nuZcnvOPDbs1rRraFG4UsfTE_IxoRxnu.TCrDMxf9lRe3bJUP"; // Replace with your Salesforce Client ID
const REDIRECT_URI =
  "https://script.google.com/macros/s/1UH5PcXTekPhRML0xKnHD2JHfsMk4OhAD_4tdorv8OEIWc39qiRLcXol9/usercallback"; // Replace with your redirect URI

// Route to get the auth URL
app.post("/getAuthUrl", (req, res) => {
  const { email, sheetId } = req.body;

  // Generate the Salesforce OAuth2 auth URL
  const authUrl = `https://login.salesforce.com/services/oauth2/authorize
    ?response_type=code
    &client_id=${CLIENT_ID}
    &redirect_uri=${encodeURIComponent(REDIRECT_URI)}
    &scope=api refresh_token full`;

  // Store the session (email and sheetId) in memory
  userSessions[email] = { sheetId };

  res.json({ authUrl });
});

// Handle the callback from Salesforce after user authorization
app.get("/usercallback", (req, res) => {
  const { code } = req.query; // Authorization code from Salesforce
  const { email } = req.query; // The email to look up user session data

  if (!code || !email) {
    return res.status(400).send("Missing code or email in callback");
  }

  // Retrieve the session from the memory (email -> session data)
  const session = userSessions[email];
  if (!session) {
    return res.status(404).send("Session not found for the user");
  }

  // Now you can exchange the `code` for an access token from Salesforce.
  // Example of doing this would be to make an HTTP POST request to Salesforce's token endpoint.

  // Ideally, you'd use a library like axios to post to Salesforce and get the access token.

  res.send(`Authorization code received: ${code} for email: ${email}`);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
