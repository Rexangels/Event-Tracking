import test from 'node:test';
import assert from 'node:assert/strict';

import {
    clearStoredAuth,
    decodeTokenPayload,
    getAuthorizedHeaders,
    hasActiveSession,
    persistAuthTokens,
} from '../services/authSession.js';

const createStorage = () => {
    const store = new Map();
    return {
        getItem: (key) => store.has(key) ? store.get(key) : null,
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

const encodeSegment = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const createToken = (payload) => `${encodeSegment({ alg: 'HS256', typ: 'JWT' })}.${encodeSegment(payload)}.signature`;

test.beforeEach(() => {
    globalThis.localStorage = createStorage();
    clearStoredAuth();
});

test('decodeTokenPayload reads the JWT payload structure', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = createToken({ sub: 'user-1', exp });

    assert.deepEqual(decodeTokenPayload(token), {
        sub: 'user-1',
        exp,
    });
});

test('hasActiveSession stays true when access is expired but refresh is still valid', () => {
    persistAuthTokens({
        access: createToken({ exp: Math.floor(Date.now() / 1000) - 60 }),
        refresh: createToken({ exp: Math.floor(Date.now() / 1000) + 86400 }),
    });

    assert.equal(hasActiveSession(), true);
});

test('getAuthorizedHeaders returns a bearer header when a valid access token exists', async () => {
    const token = createToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    persistAuthTokens({ access: token, refresh: createToken({ exp: Math.floor(Date.now() / 1000) + 86400 }) });

    const headers = await getAuthorizedHeaders(null, { 'Content-Type': 'application/json' });

    assert.equal(headers.Authorization, `Bearer ${token}`);
    assert.equal(headers['Content-Type'], 'application/json');
});