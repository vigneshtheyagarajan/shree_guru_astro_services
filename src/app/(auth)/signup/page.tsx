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
} from "@/components/ui";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
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

    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
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
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Sign up"}
          </Button>
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton />
          <p className="text-center text-sm text-foreground-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:text-primary-hover">
              Log in
            </Link>
          </p>
          <p className="text-center text-sm text-foreground-muted">
            Are you an astrologer?{" "}
            <Link
              href="/apply-astrologer"
              className="text-primary hover:text-primary-hover"
            >
              Apply here
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
