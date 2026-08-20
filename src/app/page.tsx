"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
  Stepper,
} from "@/components/ui";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-medium text-primary">
          Shree Guru Astro Services
        </span>
        <h1 className="text-3xl font-semibold text-foreground">
          UI component preview
        </h1>
        <p className="text-sm text-foreground-muted">
          Base theme + component set for the booking platform.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3">
        <Button variant="primary">Book Now</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Cancel</Button>
        <Badge variant="primary">Online</Badge>
        <Badge variant="success">Confirmed</Badge>
        <Badge variant="warning">Pending</Badge>
        <Badge variant="danger">Cancelled</Badge>
      </section>

      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Pandit Ramesh Sharma</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-foreground-muted">
            Vedic Astrology · Tamil, English · 12 yrs experience
          </p>
          <div className="flex gap-3">
            <Input label="Date of Birth" type="date" />
            <Select
              label="Concern"
              placeholder="Select a concern"
              options={[
                { label: "Marriage", value: "marriage" },
                { label: "Career", value: "career" },
                { label: "Health", value: "health" },
              ]}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => setModalOpen(true)}>
            Book a Slot
          </Button>
        </CardFooter>
      </Card>

      <Stepper
        steps={["Service", "Astrologer", "Intake", "Slot", "Confirm"]}
        currentStep={3}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm Booking"
      >
        <p className="text-sm text-foreground-muted">
          This is a placeholder for the booking confirmation flow.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setModalOpen(false)}>Confirm</Button>
        </div>
      </Modal>
    </main>
  );
}
