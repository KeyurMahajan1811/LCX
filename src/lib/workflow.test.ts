import assert from "node:assert/strict";
import test from "node:test";
import { getDisplayStatus } from "./status";
import { resolveTransition } from "./workflow";

test("vendor sees action required when the request is pending with them", () => {
  assert.equal(getDisplayStatus("PENDING_AT_VENDOR", "VENDOR").label, "Action Required");
  assert.equal(getDisplayStatus("PENDING_AT_VENDOR", "BANK_OFFICIAL").label, "Pending at Vendor");
});

test("bank sees action required after a vendor query", () => {
  assert.equal(getDisplayStatus("PENDING_AT_BANK", "BANK_OFFICIAL").label, "Action Required");
  assert.equal(getDisplayStatus("PENDING_AT_BANK", "VENDOR").label, "Pending at Bank");
});

test("only the party who must act can advance, and either side can cancel an open request", () => {
  assert.equal(resolveTransition("VENDOR", "PENDING_AT_VENDOR", "advance"), "PENDING_AT_BANK");
  assert.equal(resolveTransition("VENDOR", "PENDING_AT_VENDOR", "complete"), "COMPLETED");
  assert.equal(resolveTransition("BANK_OFFICIAL", "PENDING_AT_VENDOR", "advance"), null);
  assert.equal(resolveTransition("BANK_OFFICIAL", "PENDING_AT_BANK", "advance"), "PENDING_AT_VENDOR");
  assert.equal(resolveTransition("VENDOR", "PENDING_AT_BANK", "advance"), null);
  assert.equal(resolveTransition("BANK_OFFICIAL", "PENDING_AT_BANK", "cancel"), "CANCELLED");
  assert.equal(resolveTransition("VENDOR", "COMPLETED", "cancel"), null);
});
