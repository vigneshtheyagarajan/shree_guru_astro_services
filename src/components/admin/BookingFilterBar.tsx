"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

const STATUS_OPTIONS = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAYMENT_LINK_SENT",
  "PAID",
  "RATED",
  "CANCELLED",
  "NO_SHOW",
].map((status) => ({ label: status.replace(/_/g, " "), value: status }));

export function BookingFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";

  function handleChange(status: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    router.push(`/admin/bookings${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <Select
      label="Filter by status"
      placeholder="All statuses"
      value={currentStatus}
      onChange={(event) => handleChange(event.target.value)}
      options={STATUS_OPTIONS}
      className="w-56"
    />
  );
}
