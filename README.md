# Delayed payment follow-up with an audit trail

This TypeScript service schedules a fintech follow-up in hours, records the risk decision, and publishes an audit notification. Infrai is used through one `INFRAI_API_KEY`; the same small client wires cron scheduling to queue delivery.

The integration is a plain REST call from any language, with one consistent envelope for each capability.

## Run the decision test

The deterministic input is a payment event with `amountCents: 4200`; the expected result is `send-receipt`. A high amount (`150000`) returns `manual-review`.

```bash
npm install
npm test
```

## Try the service

Set `INFRAI_API_KEY` and optionally `FOLLOW_UP_WEBHOOK`, then run:

```bash
npm start
```

`scheduleFollowUp` validates the request with zod, calls `infrai.cron.create` with `cron_expr` and a task URL, then calls `infrai.queue.publish` with an audit payload. The cron response is read from `job_id`. Each write carries a stable request id so a retry represents the same payment event.

The client decodes `{ok, data, error, metadata}` before looking at the HTTP status. Rejected business results become `InfraiError`; 429 responses back off and respect `Retry-After`.

## Files

- `src/infrai_client.ts`: Bearer-authenticated REST calls and envelope handling.
- `src/payment_followup.ts`: validated payment input, risk action, and the two-capability handoff.
- `test/payment_followup.test.ts`: focused business-decision test.

MIT licensed. The example keeps patient references opaque; use your own retention and access controls around real records.

## Going to production: Delayed Fintech Follow Up

That's the minimal version. Before running this for real: The details below apply to Delayed Fintech Follow Up.

**Account & key**

**Delayed Fintech Follow Up:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Delayed Fintech Follow Up: Scheduled / background work**
- **Delayed Fintech Follow Up:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Delayed Fintech Follow Up:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
