import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateWallet } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { WalletTopUpForm } from "@/components/wallet/WalletTopUpForm";
import { formatDateTimeShort } from "@/lib/dateFormat";

const TRANSACTION_LABELS: Record<string, string> = {
  TOP_UP: "Top-up",
  BOOKING_PAYMENT: "Booking payment",
  REFUND: "Refund",
  LOYALTY_BONUS: "Loyalty bonus",
};

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/wallet");
  }

  const wallet = await getOrCreateWallet(session.user.id);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Wallet</h1>
        <p className="text-sm text-foreground-muted">
          Top up your balance and use it to pay for sessions instantly.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-3xl font-semibold text-foreground">₹{wallet.balance}</p>
          <WalletTopUpForm clientName={session.user.name ?? ""} clientEmail={session.user.email ?? ""} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Transaction History</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-foreground-muted">No transactions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm"
              >
                <span className="text-foreground">
                  {TRANSACTION_LABELS[transaction.type] ?? transaction.type}
                </span>
                <span className="flex items-center gap-3">
                  <span className={transaction.amount >= 0 ? "text-success" : "text-danger"}>
                    {transaction.amount >= 0 ? "+" : ""}
                    ₹{transaction.amount}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {formatDateTimeShort(transaction.createdAt)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
