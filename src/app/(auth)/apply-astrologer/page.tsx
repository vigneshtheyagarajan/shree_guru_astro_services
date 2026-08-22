"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@/components/ui";
import { PhotoUploadField } from "@/components/forms/PhotoUploadField";

export default function ApplyAstrologerPage() {
  const router = useRouter();
  const [step, setStep] = useState<"application" | "photo">("application");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/astrologers/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        phone,
        bio,
        languages: languages.split(",").map((lang) => lang.trim()).filter(Boolean),
        experienceYears: experienceYears ? Number(experienceYears) : null,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);

    if (result?.error) {
      router.push("/login");
      return;
    }

    // Signed in now, so the photo upload's Cloudinary signature request
    // (auth-gated) can succeed -- continue the same flow into a photo step
    // instead of redirecting straight to the dashboard.
    setStep("photo");
  }

  async function handleFinishPhotoStep() {
    setSubmitting(true);
    if (photoUrl) {
      await fetch("/api/astrologer/profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
    }
    setSubmitting(false);
    router.push("/astrologer/dashboard");
    router.refresh();
  }

  if (step === "photo") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add a photo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-foreground-muted">
            A clear photo helps clients recognize and trust you. You can also add or change
            this later.
          </p>
          <PhotoUploadField
            label="Profile photo"
            required={false}
            value={photoUrl}
            onChange={setPhotoUrl}
          />
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button
            type="button"
            className="w-full"
            disabled={submitting}
            onClick={handleFinishPhotoStep}
          >
            {submitting ? "Saving…" : photoUrl ? "Finish" : "Skip for now"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply as an Astrologer</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <Input
            label="Full name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Textarea
            label="Bio"
            required
            placeholder="Tell clients about your background and specialties"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
          <Input
            label="Languages (comma separated)"
            required
            placeholder="Tamil, English, Hindi"
            value={languages}
            onChange={(event) => setLanguages(event.target.value)}
          />
          <Input
            label="Years of experience"
            type="number"
            min={0}
            value={experienceYears}
            onChange={(event) => setExperienceYears(event.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
          <p className="text-center text-sm text-foreground-muted">
            Looking to book a consultation instead?{" "}
            <Link href="/signup" className="text-primary hover:text-primary-hover">
              Sign up as a client
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
