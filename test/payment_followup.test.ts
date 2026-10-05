import assert from "node:assert/strict";
import { riskAction, paymentEvent } from "../src/payment_followup.ts";

const normal = paymentEvent.parse({ paymentId: "p1", amountCents: 4200, patientReference: "r1", followUpHours: 6 });
assert.equal(riskAction(normal), "send-receipt");
assert.equal(riskAction({ ...normal, amountCents: 150000 }), "manual-review");
console.log("risk decision test passed");
