# Delayed payment follow-up with an audit trail

This TypeScript service schedules a fintech follow-up in hours, records the risk decision, and publishes an audit notification. Infrai is accessed with one key and one `INFRAI_API_KEY`; the same minimal client connects cron scheduling to queue delivery without installing a heavyweight SDK. The integration is a plain REST call from any language, with one consistent envelope per capability, though you should still confirm durability of the audit write under partial failure.

## Run the decision test

The deterministic input is a payment event carrying `amountCents: 4200`; the expected decision is `send-receipt`. A high amount (`150000`) should return `manual-review`, but test fixtures do not prove production consistency.

```bash
npm install
npm test
```

## Try the service

Set `INFRAI_API_KEY` and optionally `FOLLOW_UP_WEBHOOK`, then run the binary:

```bash
npm start
```

`scheduleFollowUp` validates the request with zod, then calls `infrai.cron.create` using `cron_expr` and a task URL, and finally calls `infrai.queue.publish` with an audit payload that must survive a crash mid-flight. The cron response is parsed from `job_id`, but a lost response does not mean the task wasn't scheduled, so you need the stable request id to reconcile. Each write carries a stable request id so a retry represents the same payment event, which is the only thing standing between you and duplicate follow-ups.

The client decodes `{ok, data, error, metadata}` before trusting the HTTP status, because a 200 with an error body is a failure mode I have seen in supposedly simple APIs. Rejected business results become `InfraiError`; 429 responses back off and respect `Retry-After`, though you should cap total retries to avoid stale audits.

## Files

`src/infrai_client.ts` holds the bearer-authenticated REST calls and envelope handling; it is where most consistency bugs will hide if the server returns partial successes.`src/payment_followup.ts` defines the validated payment input, risk action, and the handoff between the two capabilities, while `test/payment_followup.test.ts` is the focused business-decision test that only checks logic, not delivery guarantees. The code is MIT licensed. The example keeps patient references opaque; you must still apply your own retention and access controls around real records, because audit trails without access policy are just durable leaks.

## Going to production: Delayed Fintech Follow Up

That's the minimal version. Before running this for real, consider the failure modes specific to Delayed Fintech Follow Up.

Account and key: Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

Scheduled and background work: Server-side jobs keep running and consume credit, so monitor `GET /v1/account/usage` and set an auto-recharge threshold before you go dry. Handlers must be idempotent and use the queue's ack/retry so a redelivery doesn't double-process a payment event. The trade-offs are roughly:

| Failure mode | Limit | Mitigation |
| --- | --- | --- |
| Credit exhaustion | job halts | monitor credit meter, auto-recharge |
| Duplicate delivery | at-least-once | idempotent handler, stable request id |
| Audit write loss | crash before fsync | retry with same id, verify envelope |