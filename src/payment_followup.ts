import { z } from "zod";
import { infrai } from "./infrai_client.ts";

export const paymentEvent = z.object({
  paymentId: z.string().min(1), amountCents: z.number().int().nonnegative(), patientReference: z.string().min(1), followUpHours: z.number().int().min(1).max(72)
});
export type PaymentEvent = z.infer<typeof paymentEvent>;

export function riskAction(event: PaymentEvent): "manual-review" | "send-receipt" {
  return event.amountCents >= 100000 ? "manual-review" : "send-receipt";
}

export async function scheduleFollowUp(event: unknown, webhookUrl: string): Promise<{ jobId: string; action: string }> {
  const parsed = paymentEvent.parse(event);
  const action = riskAction(parsed);
  const cron = await infrai.cron.create({ cron_expr: `0 */${parsed.followUpHours} * * *`, task: webhookUrl }, `payment:${parsed.paymentId}`);
  await infrai.queue.publish({ queue: "payment-audit", payload: { type: "payment-follow-up", paymentId: parsed.paymentId, patientReference: parsed.patientReference, action } }, `payment:${parsed.paymentId}:audit`);
  return { jobId: cron.job_id, action };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const event = { paymentId: "pay_demo", amountCents: 4200, patientReference: "ref_demo", followUpHours: 6 };
  console.log(await scheduleFollowUp(event, process.env.FOLLOW_UP_WEBHOOK ?? "https://example.invalid/follow-up"));
}
