/** Server-side session availability for chat / voice / video. */
const CONNECTION_STATES = {
  AVAILABLE: 'available',
  CHAT_CONNECTED: 'chat_connected',
  VOICE_CONNECTED: 'voice_connected',
  VIDEO_CONNECTED: 'video_connected',
};

const CONNECTION_STATE_VALUES = Object.values(CONNECTION_STATES);

const BUSY_STATES = new Set([
  CONNECTION_STATES.CHAT_CONNECTED,
  CONNECTION_STATES.VOICE_CONNECTED,
  CONNECTION_STATES.VIDEO_CONNECTED,
]);

function isBusyState(state) {
  return BUSY_STATES.has(state);
}

function callModeToState(mode) {
  return mode === 'voice'
    ? CONNECTION_STATES.VOICE_CONNECTED
    : CONNECTION_STATES.VIDEO_CONNECTED;
}

module.exports = {
  CONNECTION_STATES,
  CONNECTION_STATE_VALUES,
  BUSY_STATES,
  isBusyState,
  callModeToState,
};
