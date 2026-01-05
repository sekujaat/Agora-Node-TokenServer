// Import required dependencies
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const {
  RtcTokenBuilder,
  RtcRole,
  RtmTokenBuilder,
  RtmRole,
} = require('agora-access-token');
const db = require('./db');

// Load environment variables from .env file
dotenv.config();

// Initialize Express app and configuration constants
const app = express();
const PORT = process.env.PORT || 8080;
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

/**
 * Middleware to prevent caching of responses
 * This ensures tokens are always generated fresh
 */
const nocache = (_, resp, next) => {
  resp.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  resp.header('Expires', '-1');
  resp.header('Pragma', 'no-cache');
  next();
};

/**
 * Simple health check endpoint
 */
const ping = (req, resp) => {
  resp.send({ message: 'pong' });
};

/**
 * Generate RTC token for video/audio communication
 * @param {string} channel - Channel name
 * @param {string} uid - User ID
 * @param {string} role - User role (publisher/audience)
 * @param {string} tokentype - Token type (userAccount/uid)
 * @param {number} expiry - Token expiry time in seconds
 */
const generateRTCToken = (req, resp) => {
  // set response header
  resp.header('Access-Control-Allow-Origin', '*');
  // get channel name
  const channelName = req.params.channel;
  if (!channelName) {
    return resp.status(400).json({ error: 'channel is required' });
  }
  // get uid
  let uid = req.params.uid;
  if (!uid || uid === '') {
    return resp.status(400).json({ error: 'uid is required' });
  }
  // get role
  let role;
  if (req.params.role === 'publisher') {
    role = RtcRole.PUBLISHER;
  } else if (req.params.role === 'audience') {
    role = RtcRole.SUBSCRIBER;
  } else {
    return resp.status(400).json({ error: 'role is incorrect' });
  }
  // get the expire time
  let expireTime = req.query.expiry;
  if (!expireTime || expireTime === '') {
    expireTime = 3600;
  } else {
    expireTime = parseInt(expireTime, 10);
  }
  // calculate privilege expire time
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  // build the token
  let token;
  if (req.params.tokentype === 'userAccount') {
    token = RtcTokenBuilder.buildTokenWithAccount(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );
  } else if (req.params.tokentype === 'uid') {
    token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );
  } else {
    return resp.status(400).json({ error: 'token type is invalid' });
  }
  // return the token
  return resp.json({ rtcToken: token });
};

/**
 * Generate RTM token for real-time messaging
 * @param {string} uid - User ID
 * @param {number} expiry - Token expiry time in seconds
 */
const generateRTMToken = (req, resp) => {
  // set response header
  resp.header('Access-Control-Allow-Origin', '*');

  // get uid
  let uid = req.params.uid;
  if (!uid || uid === '') {
    return resp.status(400).json({ error: 'uid is required' });
  }
  // get role
  let role = RtmRole.Rtm_User;
  // get the expire time
  let expireTime = req.query.expiry;
  if (!expireTime || expireTime === '') {
    expireTime = 3600;
  } else {
    expireTime = parseInt(expireTime, 10);
  }
  // calculate privilege expire time
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  // build the token
  console.log(APP_ID, APP_CERTIFICATE, uid, role, privilegeExpireTime);
  const token = RtmTokenBuilder.buildToken(
    APP_ID,
    APP_CERTIFICATE,
    uid,
    role,
    privilegeExpireTime
  );
  // return the token
  return resp.json({ rtmToken: token });
};

/**
 * Generate both RTC and RTM tokens in a single request
 * Useful for applications needing both video/audio and messaging capabilities
 * @param {string} channel - Channel name
 * @param {string} uid - User ID
 * @param {string} role - User role (publisher/audience)
 * @param {number} expiry - Token expiry time in seconds
 */
const generateRTEToken = (req, resp) => {
  // set response header
  resp.header('Access-Control-Allow-Origin', '*');
  // get channel name
  const channelName = req.params.channel;
  if (!channelName) {
    return resp.status(400).json({ error: 'channel is required' });
  }
  // get uid
  let uid = req.params.uid;
  if (!uid || uid === '') {
    return resp.status(400).json({ error: 'uid is required' });
  }
  // get role
  let role;
  if (req.params.role === 'publisher') {
    role = RtcRole.PUBLISHER;
  } else if (req.params.role === 'audience') {
    role = RtcRole.SUBSCRIBER;
  } else {
    return resp.status(400).json({ error: 'role is incorrect' });
  }
  // get the expire time
  let expireTime = req.query.expiry;
  if (!expireTime || expireTime === '') {
    expireTime = 3600;
  } else {
    expireTime = parseInt(expireTime, 10);
  }
  // calculate privilege expire time
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  // build the token
  const rtcToken = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpireTime
  );
  const rtmToken = RtmTokenBuilder.buildToken(
    APP_ID,
    APP_CERTIFICATE,
    uid,
    role,
    privilegeExpireTime
  );
  // return the token
  return resp.json({ rtcToken: rtcToken, rtmToken: rtmToken });
};

// Configure CORS and routes
app.options('*', cors());

// Define API endpoints
app.get('/ping', nocache, ping);
app.get('/rtc/:channel/:role/:tokentype/:uid', nocache, generateRTCToken); // Endpoint for RTC token generation
app.get('/rtm/:uid/', nocache, generateRTMToken); // Endpoint for RTM token generation
app.get('/rte/:channel/:role/:tokentype/:uid', nocache, generateRTEToken); // Endpoint for both RTC and RTM token generation
app.use(express.json());

// save usage
app.post('/usage/save', async (req, res) => {
  try {
    const { uid, callTime, callCount, screenTime, location } = req.body;

    const query = `
      INSERT INTO usage_stats
        (firebase_uid, date, total_call_time, call_count, screen_time, last_location)
      VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
      ON CONFLICT (firebase_uid, date)
      DO UPDATE SET
        total_call_time = usage_stats.total_call_time + EXCLUDED.total_call_time,
        call_count      = usage_stats.call_count      + EXCLUDED.call_count,
        screen_time     = usage_stats.screen_time     + EXCLUDED.screen_time,
        last_location   = EXCLUDED.last_location;
    `;

    const values = [
      uid,
      callTime || 0,
      callCount || 0,
      screenTime || 0,
      location || null,
    ];

    await db.query(query, values);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// get last 7 days usage
app.get('/usage/get', async (req, res) => {
  try {
    const { uid } = req.query;

    const query = `
      SELECT date,
             total_call_time,
             call_count,
             screen_time,
             last_location
      FROM usage_stats
      WHERE firebase_uid = $1
        AND date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY date DESC;
    `;

    const { rows } = await db.query(query, [uid]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});

// Export the app for testing
module.exports = app;
