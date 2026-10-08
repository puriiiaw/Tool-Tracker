// Run: npm test. Five wrong tries lock an email for the window; a right password or the window passing clears it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeThrottle } from "./throttle.ts";

test("locks after 5 fails, per key, until the window passes", () => {
  const t = makeThrottle(5, 1000);
  for (let i = 0; i < 4; i++) t.fail("a", 0);
  assert.equal(t.locked("a", 0), false);
  t.fail("a", 0);
  assert.equal(t.locked("a", 500), true);
  assert.equal(t.locked("b", 500), false); // other emails unaffected
  assert.equal(t.locked("a", 1000), false); // window over
  t.fail("a", 2000);
  t.ok("a");
  assert.equal(t.locked("a", 2000), false);
});
