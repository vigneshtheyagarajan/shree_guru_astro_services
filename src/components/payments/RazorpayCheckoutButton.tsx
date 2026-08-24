"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay Checkout.")));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

export function RazorpayCheckoutButton({
  razorpayKeyId,
  orderId,
  amount,
  name = "Shree Guru Astro Services",
  description,
  prefillName,
  prefillEmail,
  verifyUrl,
  label = "Pay Now",
}: {
  razorpayKeyId: string;
  orderId: string;
  amount: number;
  name?: string;
  description?: string;
  prefillName?: string;
  prefillEmail?: string;
  verifyUrl: string;
  label?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setStatus("loading");
    try {
      await loadCheckoutScript();
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Failed to load payment window.");
      return;
    }

    const razorpayCheckout = new window.Razorpay({
      key: razorpayKeyId,
      order_id: orderId,
      amount: amount * 100,
      currency: "INR",
      name,
      description,
      prefill: { name: prefillName, email: prefillEmail },
      theme: { color: "#ff7a1a" },
      modal: {
        ondismiss: () => setStatus("idle"),
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        setStatus("verifying");
        const verifyResponse = await fetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        });
        setStatus("idle");
        if (!verifyResponse.ok) {
          const body = await verifyResponse.json().catch(() => null);
          setError(body?.error ?? "Payment succeeded but verification failed. Please contact support.");
          return;
        }
        router.refresh();
      },
    });
    setStatus("idle");
    razorpayCheckout.open();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" onClick={handleClick} loading={status !== "idle"}>
        {status === "verifying" ? "Confirming…" : label}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
