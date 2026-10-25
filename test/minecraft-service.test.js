const assert = require('node:assert/strict');
const test = require('node:test');
const { getRequiredJavaMajor } = require('../src/minecraft-service');

test('selects the Java generation required by common Minecraft releases', () => {
  assert.equal(getRequiredJavaMajor('1.12.2'), 8);
  assert.equal(getRequiredJavaMajor('1.17.1'), 16);
  assert.equal(getRequiredJavaMajor('1.20.4'), 17);
  assert.equal(getRequiredJavaMajor('1.20.5'), 21);
  assert.equal(getRequiredJavaMajor('1.21.0'), 21);
  assert.equal(getRequiredJavaMajor('1.21.11'), 21);
  assert.equal(getRequiredJavaMajor('26.3'), 25);
});