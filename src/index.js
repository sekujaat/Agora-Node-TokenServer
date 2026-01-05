require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

// Basic health check
app.get('/', (req, res) => {
  res.send('Agora Token Server is running');
});

// Generate RTC token
app.get('/rtcToken', (req, res) => {
  const channelName = req.query.channelName;
  if (!channelName) {
    return res.status(400).json({ error: 'channelName is required' });
  }

  const uid = req.query.uid || 0;
  const role = RtcRole.PUBLISHER;
  const expireTime = 3600; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireTime;

  if (!APP_ID || !APP_CERTIFICATE) {
    return res.status(500).json({ error: 'APP_ID or APP_CERTIFICATE missing' });
  }

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpiredTs
  );

  return res.json({ token });
});

app.listen(port, () => {
  console.log(`Agora Token Server listening on port ${port}`);
});
