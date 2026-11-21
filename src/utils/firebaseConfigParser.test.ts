import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeConfigValue,
  sanitizeFirebaseClientConfig,
  validateFirebaseApiKeyFormat,
  parseFirebaseConfigSnippet,
} from './firebaseConfigParser.ts';

test('sanitizeConfigValue strips quotes, spaces, and trailing commas', () => {
  assert.equal(sanitizeConfigValue('  "AIzaSyTest123456789012345678901234567", '), 'AIzaSyTest123456789012345678901234567');
  assert.equal(sanitizeConfigValue(" 'extintores-prod'; "), 'extintores-prod');
});

test('validateFirebaseApiKeyFormat catches placeholders, App IDs, and malformed keys', () => {
  const placeholder = validateFirebaseApiKeyFormat('AIzaSy...');
  assert.equal(placeholder.valid, false);

  const appIdSwapped = validateFirebaseApiKeyFormat('1:1234567890:web:abcdef123456');
  assert.equal(appIdSwapped.valid, false);
  assert.match(appIdSwapped.error || '', /App ID/i);

  const valid = validateFirebaseApiKeyFormat('"AIzaSyD9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567",');
  assert.equal(valid.valid, true);
  assert.equal(valid.cleanedKey, 'AIzaSyD9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567');
});

test('parseFirebaseConfigSnippet extracts fields from JS snippet and JSON', () => {
  const jsSnippet = `
    const firebaseConfig = {
      apiKey: "AIzaSyD9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567",
      authDomain: "extintores-prod.firebaseapp.com",
      projectId: "extintores-prod",
      storageBucket: "extintores-prod.firebasestorage.app",
      messagingSenderId: "9988776655",
      appId: "1:9988776655:web:abcdef123456"
    };
  `;

  const parsedJs = parseFirebaseConfigSnippet(jsSnippet);
  assert.equal(parsedJs.success, true);
  assert.equal(parsedJs.config?.apiKey, 'AIzaSyD9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567');
  assert.equal(parsedJs.config?.projectId, 'extintores-prod');
  assert.equal(parsedJs.config?.appId, '1:9988776655:web:abcdef123456');

  const jsonSnippet = '{"projectId":"extintores-json","apiKey":"AIzaSyD9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567"}';
  const parsedJson = parseFirebaseConfigSnippet(jsonSnippet);
  assert.equal(parsedJson.success, true);
  assert.equal(parsedJson.config?.projectId, 'extintores-json');
});

test('sanitizeFirebaseClientConfig cleans all properties cleanly', () => {
  const cleaned = sanitizeFirebaseClientConfig({
    projectId: ' "my-proj", ',
    apiKey: ' "AIzaSyD9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567" ',
    authDomain: ' ',
  });
  assert.equal(cleaned.projectId, 'my-proj');
  assert.equal(cleaned.apiKey, 'AIzaSyD9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567');
  assert.equal(cleaned.authDomain, undefined);
});
