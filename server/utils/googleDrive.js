const { google } = require("googleapis");

const getDriveClient = (accessToken) => {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: oauth2Client });
};

const refreshAccessToken = async (refreshToken) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { tokens } = await oauth2Client.refreshAccessToken();
  return tokens.access_token;
};

module.exports = {
  getDriveClient,
  refreshAccessToken,
};
