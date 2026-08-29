import { LiveKitAPI } from 'livekit-server-sdk';
import { config } from './config.js';

export const api = new LiveKitAPI({
  host: config.livekitUrl,
  apiKey: config.apiKey,
  secret: config.apiSecret,
});
