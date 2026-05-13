import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRemoteAccessLink } from './remoteAccessLogic.js';

test('remote access link is hidden while relay is disabled', () => {
  const link = buildRemoteAccessLink({
    relayEnabled: false,
    relayUrl: 'wss://relay.example/connect',
    relayToken: 'secret-token',
  });

  assert.equal(link, null);
});

test('remote access link is generated only when relay is enabled and configured', () => {
  const link = buildRemoteAccessLink({
    relayEnabled: true,
    relayUrl: 'wss://relay.example/connect',
    relayToken: 'secret-token',
    pagesOrigin: 'https://example.test/gaggimate',
  });

  assert.equal(
    link,
    'https://example.test/gaggimate?relay=wss%3A%2F%2Frelay.example%2Fconnect&token=secret-token',
  );
});
