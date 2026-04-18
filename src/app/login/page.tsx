import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  let session = null;
  try {
    session = await auth();
  } catch {
    // Auth config error — show login page instead of looping
  }
  if (session) redirect("/dashboard");

  const params = await searchParams;
  const error = params.error;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo-workstation.jpg"
            alt="Work Station"
            width={120}
            height={120}
            className="rounded-2xl"
            priority
          />
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              WorkGov
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tender Management System
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error === "AccessDenied"
              ? "Access denied. Only @workstationoffice.com accounts are allowed."
              : "Sign in failed. Please try again."}
          </div>
        )}

        {/* Sign-in form */}
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", {
              redirectTo: params.callbackUrl || "/dashboard",
            });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Sign in with Microsoft 365
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Work Station Office employees only
        </p>
      </div>
    </div>
  );
}
