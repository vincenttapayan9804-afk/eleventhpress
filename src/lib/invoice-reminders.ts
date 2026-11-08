import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { invoiceItemLabel, invoiceNumber } from "@/lib/invoice-format";

const DAY = 86400000;
// Reminder schedule for an open invoice: a week after issue, then three weeks.
const SCHEDULE_DAYS = [7, 21];

/**
 * Friendly payment reminders for open invoices (run daily from
 * /api/cron/sweep-all), each sent once: 7 and 21 days after the invoice was
 * issued. Purchase-order invoices are settled offline and are skipped.
 */
export async function sendInvoiceReminders(now = new Date()): Promise<{ sent: number }> {
  let sent = 0;
  for (const [i, days] of SCHEDULE_DAYS.entries()) {
    const due = await db.invoice.findMany({
      where: {
        status: "OPEN",
        billingMethod: null,
        remindersSent: i,
        createdAt: { lte: new Date(now.getTime() - days * DAY), gte: new Date(now.getTime() - 120 * DAY) },
      },
      include: { article: { select: { title: true } }, book: { select: { title: true } } },
      take: 200,
    });
    for (const inv of due) {
      const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency || "USD" }).format(inv.amount);
      await notify({
        userId: inv.userId,
        type: i === 0 ? "INFO" : "WARNING",
        category: "BILLING",
        link: `/billing/${inv.id}`,
        title: i === 0 ? "Reminder: invoice awaiting payment" : "Your invoice is still open",
        message: `${invoiceItemLabel(inv)} (${invoiceNumber(inv.id, inv.createdAt)}) for ${amount} is awaiting payment. ${
          inv.type === "APC" ? "Production starts as soon as it's settled. " : ""
        }Pay from Billing & invoices in your dashboard, or reply to the editorial office if you need a waiver or another payment method.`,
        articleId: inv.articleId ?? undefined,
      });
      await db.invoice.update({ where: { id: inv.id }, data: { remindersSent: i + 1 } });
      sent++;
    }
  }
  return { sent };
}
