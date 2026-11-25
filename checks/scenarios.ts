// Money scenarios for the money-correctness task. Run from the repository root: npx tsx /tmp/scenarios.ts
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const FAKE = "http://127.0.0.1:4010";
const ctl = (b: object) => fetch(`${FAKE}/__ctl`, { method: "POST", body: JSON.stringify(b) });
const stats = async () => (await fetch(`${FAKE}/__stats`)).json();
let seq = 0;
const tag = `${Date.now()}`;
const uniq = (p: string) => `${p}-${tag}-${++seq}`;
const all = <T>(n: number, f: () => Promise<T>) => Promise.all(Array.from({ length: n }, f));
const outcome = (p: Promise<unknown>) =>
  p.then(() => "ok", (e) => (e && e.constructor && e.constructor.name !== "Error" ? e.constructor.name : "Error"));
async function mod(path: string) { try { return await import(path); } catch { return {}; } }

async function client(balance = 0) {
  const u = await prisma.user.create({ data: { email: `${uniq("c")}@x.test`, name: "Client", emailNotificationsEnabled: false } });
  const w = await prisma.wallet.create({ data: { userId: u.id, balance } });
  if (balance) await prisma.walletTransaction.create({ data: { walletId: w.id, amount: balance, type: "TOP_UP" } });
  return { user: u, wallet: w };
}
async function astrologer() {
  const u = await prisma.user.create({ data: { email: `${uniq("a")}@x.test`, name: "Astro", role: "ASTROLOGER", emailNotificationsEnabled: false } });
  const p = await prisma.astrologerProfile.create({ data: { userId: u.id, approvalStatus: "APPROVED", languages: ["en"],
    payoutAccountHolderName: "Astro", payoutAccountNumber: "123456789", payoutIfscCode: "HDFC0000001", commissionPercent: 20 } });
  const s = await prisma.service.create({ data: { slug: uniq("svc"), name: "Reading", description: "d", category: "c", intakeSchema: {}, supportedModes: ["CHAT"] } });
  const o = await prisma.serviceOffering.create({ data: { astrologerId: p.id, serviceId: s.id, pricePerSession: 500, modes: ["CHAT"] } });
  return { user: u, profile: p, offering: o };
}
async function booking(c: any, a: any, opts: { status?: any; link?: any; ageMin?: number; order?: string; unknownToRazorpay?: boolean } = {}) {
  const start = new Date(Date.now() + (2 * 24 * 60 + ++seq) * 60000);
  const slot = await prisma.slot.create({ data: { astrologerId: a.profile.id, startAt: start, endAt: new Date(+start + 30 * 60000), status: "BOOKED" } });
  const b = await prisma.booking.create({ data: { clientId: c.user.id, astrologerId: a.profile.id, serviceOfferingId: a.offering.id, slotId: slot.id,
    mode: "CHAT", status: opts.status ?? "PENDING", createdAt: new Date(Date.now() - (opts.ageMin ?? 0) * 60000) } });
  const order = opts.order ?? uniq("order");
  if (!opts.unknownToRazorpay) await ctl({ order });
  const link = await prisma.paymentLink.create({ data: { bookingId: b.id, razorpayOrderId: order, amount: 500, status: opts.link ?? "CREATED",
    paidAt: opts.link === "PAID" ? new Date() : null } });
  return { booking: b, slot, link, order };
}
function webhook(event: object) {
  const body = JSON.stringify(event);
  const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string).update(body).digest("hex");
  return import("@/app/api/payments/webhooks/razorpay/route").then((r) =>
    r.POST(new Request("http://x/api/payments/webhooks/razorpay", { method: "POST", body, headers: { "x-razorpay-signature": sig } })));
}
const captured = (order: string) => webhook({ event: "payment.captured", payload: { payment: { entity: { id: uniq("pay"), order_id: order } } } });
const cron = () => import("@/app/api/cron/reconcile-payments/route").then((r) => r.GET(new Request("http://x/api/cron/reconcile-payments")));
const balance = async (c: any) => (await prisma.wallet.findUnique({ where: { id: c.wallet.id } }))!.balance;
const refunds = (c: any) => prisma.walletTransaction.count({ where: { walletId: c.wallet.id, type: "REFUND" } });
const notes = (userId: string, event: string) => prisma.notification.count({ where: { userId, event: event as any, channel: "IN_APP" } });
const bstatus = async (b: any) => (await prisma.booking.findUnique({ where: { id: b.booking.id } }))!.status;
const sstatus = async (b: any) => (await prisma.slot.findUnique({ where: { id: b.slot.id } }))!.status;
const show = (name: string, o: object) => console.log(name, JSON.stringify(o));

async function run(name: string, f: () => Promise<object>) {
  try { show(name, await f()); } catch (e: any) { show(name, { crashed: String(e?.message ?? e).slice(0, 120) }); }
}

async function main() {
  const wallet = await mod("@/lib/wallet");
  const rp = await mod("@/lib/payments/razorpay");
  const payouts = await mod("@/lib/payments/razorpayPayouts");
  const disputes = await mod("@/lib/disputes");
  const cancel = await mod("@/lib/booking/cancel");

  await run("S1-topup-race", async () => {
    const c = await client(0); const order = uniq("order");
    await prisma.walletTopUp.create({ data: { walletId: c.wallet.id, amount: 1000, bonusAmount: 100, razorpayOrderId: order } });
    await all(10, () => wallet.creditWalletFromTopUp(order));
    return { balance: await balance(c), txns: await prisma.walletTransaction.count({ where: { walletId: c.wallet.id } }), notified: await notes(c.user.id, "WALLET_TOPPED_UP") };
  });
  await run("S2-overspend", async () => {
    const c = await client(500); const a = await astrologer(); const b1 = await booking(c, a); const b2 = await booking(c, a);
    const r = await Promise.all([outcome(wallet.payBookingFromWallet(b1.booking.id, c.user.id)), outcome(wallet.payBookingFromWallet(b2.booking.id, c.user.id))]);
    return { results: r.sort(), balance: await balance(c), confirmed: [await bstatus(b1), await bstatus(b2)].filter((s) => s === "CONFIRMED").length };
  });
  await run("S3-notify-once", async () => {
    const c = await client(0); const a = await astrologer(); const b = await booking(c, a);
    await all(10, () => rp.markBookingPaidFromPaymentLink(b.order));
    return { status: await bstatus(b), clientPaid: await notes(c.user.id, "PAYMENT_RECEIVED"), astroConfirmed: await notes(a.user.id, "BOOKING_CONFIRMED") };
  });
  await run("S4-wallet-then-card", async () => {
    const c = await client(1000); const a = await astrologer(); const b = await booking(c, a);
    await wallet.payBookingFromWallet(b.booking.id, c.user.id);
    await ctl({ paid: b.order });
    await all(3, () => captured(b.order));
    return { balance: await balance(c), refunds: await refunds(c), status: await bstatus(b) };
  });
  await run("S5-wallet-and-card-together", async () => {
    const c = await client(1000); const a = await astrologer(); const b = await booking(c, a);
    await ctl({ paid: b.order });
    await Promise.all([outcome(wallet.payBookingFromWallet(b.booking.id, c.user.id)), captured(b.order)]);
    return { balance: await balance(c), status: await bstatus(b) };
  });
  await run("S6-paid-after-expiry", async () => {
    const c = await client(0); const a = await astrologer(); const b = await booking(c, a, { ageMin: 20 });
    await cron();
    const after = { status: await bstatus(b), slot: await sstatus(b) };
    await ctl({ paid: b.order });
    await Promise.all([captured(b.order), captured(b.order), rp.markBookingPaidFromPaymentLink(b.order)]);
    return { ...after, finalStatus: await bstatus(b), balance: await balance(c), refunds: await refunds(c) };
  });
  await run("S7-cron-sees-paid-order", async () => {
    const c = await client(0); const a = await astrologer(); const b = await booking(c, a, { ageMin: 20 });
    await ctl({ paid: b.order });
    await cron();
    return { status: await bstatus(b), balance: await balance(c) };
  });
  await run("S7b-cron-cannot-reach-razorpay", async () => {
    const c = await client(0); const a = await astrologer(); const b = await booking(c, a, { ageMin: 20, unknownToRazorpay: true });
    await cron();
    return { status: await bstatus(b), slot: await sstatus(b) };
  });
  await run("S8-dispute-refund", async () => {
    const c = await client(0); const a = await astrologer(); const b = await booking(c, a, { status: "PAID", link: "PAID" });
    const d = await prisma.dispute.create({ data: { bookingId: b.booking.id, raisedById: c.user.id, reason: "r", description: "d" } });
    await ctl({ resetStats: true });
    await all(2, () => disputes.resolveDispute(d.id, "RESOLVED", "refund approved"));
    const p = await outcome(payouts.createPayoutForBooking(b.booking.id));
    return { dispute: (await prisma.dispute.findUnique({ where: { id: d.id } }))!.status, balance: await balance(c), refunds: await refunds(c),
      payout: p === "ok" ? "created" : "refused", payoutRequests: (await stats()).payoutRequests };
  });
  await run("S9-cancel-refund", async () => {
    const c = await client(0); const a = await astrologer();
    const paid = await booking(c, a, { status: "CONFIRMED", link: "PAID" }); const unpaid = await booking(c, a);
    await all(2, () => cancel.cancelBooking(paid.booking.id));
    await cancel.cancelBooking(unpaid.booking.id);
    return { statuses: [await bstatus(paid), await bstatus(unpaid)], slots: [await sstatus(paid), await sstatus(unpaid)], balance: await balance(c), refunds: await refunds(c) };
  });
  let payoutRzpId = "";
  let astroUser = "";
  await run("S10-payout-race", async () => {
    const c = await client(0); const a = await astrologer(); const b = await booking(c, a, { status: "PAID", link: "PAID" });
    await ctl({ resetStats: true });
    await Promise.allSettled(Array.from({ length: 5 }, () => payouts.createPayoutForBooking(b.booking.id)));
    const rows = await prisma.payout.findMany({ where: { bookingId: b.booking.id } });
    payoutRzpId = rows[0]?.razorpayPayoutId ?? ""; astroUser = a.user.id;
    const s = await stats();
    return { rows: rows.length, amount: rows[0]?.amount, payoutsCreated: s.payoutsCreated, missingKey: s.missingKey };
  });
  await run("S11-lost-response", async () => {
    const c = await client(0); const a = await astrologer(); const b = await booking(c, a, { status: "PAID", link: "PAID" });
    await ctl({ resetStats: true }); await ctl({ fail503Once: true });
    await outcome(payouts.createPayoutForBooking(b.booking.id));
    const first = (await prisma.payout.findUnique({ where: { bookingId: b.booking.id } }))!;
    await payouts.retryPayout(first.id);
    const final = (await prisma.payout.findUnique({ where: { bookingId: b.booking.id } }))!;
    const s = await stats();
    return { afterFirstNotFailed: first.status !== "FAILED", final: final.status, hasRazorpayId: !!final.razorpayPayoutId, payoutsCreated: s.payoutsCreated, distinctKeys: s.distinctKeys };
  });
  await run("S12-payout-rejected-then-retried", async () => {
    const c = await client(0); const a = await astrologer(); const b = await booking(c, a, { status: "PAID", link: "PAID" });
    await ctl({ resetStats: true }); await ctl({ fail400Once: true });
    await outcome(payouts.createPayoutForBooking(b.booking.id));
    const first = (await prisma.payout.findUnique({ where: { bookingId: b.booking.id } }))!;
    await payouts.retryPayout(first.id);
    const final = (await prisma.payout.findUnique({ where: { bookingId: b.booking.id } }))!;
    return { afterFirst: first.status, final: final.status, payoutsCreated: (await stats()).payoutsCreated };
  });
  await run("S13-payout-webhooks", async () => {
    const ev = (status: string) => webhook({ event: `payout.${status}`, payload: { payout: { entity: { id: payoutRzpId, status } } } });
    await all(3, () => ev("processed"));
    await ev("processing");
    const p = (await prisma.payout.findFirst({ where: { razorpayPayoutId: payoutRzpId } }))!;
    return { status: p.status, notifications: await notes(astroUser, "PAYOUT_PROCESSED") };
  });
  await run("S14-ledger-invariant", async () => {
    const bad = await prisma.$queryRawUnsafe<any[]>(
      `select count(*)::int as n from "Wallet" w where w.balance < 0 or w.balance <> coalesce((select sum(t.amount) from "WalletTransaction" t where t."walletId" = w.id), 0)`);
    return { badWallets: bad[0].n };
  });
  await prisma.$disconnect();
  process.exit(0);
}
main();
