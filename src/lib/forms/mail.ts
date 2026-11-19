/**
 * Emails to the person who sent a public Official Form (EP-F-23 to
 * EP-F-26), who may have no account: the acknowledgement and the outcome.
 */
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { emailBrandForTenantId } from "@/lib/email-brand";

/** The reference quoted to the sender, e.g. "EP-F-23-8K2D9QXA". */
export const formReference = (row: { id: string; formCode: string }) => `${row.formCode}-${row.id.slice(-8).toUpperCase()}`;

export async function emailFormContact(to: string | null | undefined, tenantId: string | null | undefined, title: string, message: string): Promise<void> {
  if (!to) return;
  const brand = await emailBrandForTenantId(tenantId);
  await sendEmail({ to, replyTo: brand?.replyTo, subject: title, html: notificationEmailHtml({ title, message, brand }), text: `${title}\n\n${message}` }).catch((e) =>
    console.error("[forms] contact email failed:", e)
  );
}
