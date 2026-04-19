import { AppSidebar } from "@/components/layout/app-sidebar";
import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-full w-full">
      <AppSidebar user={session?.user} />
      <main className="overflow-auto">
        <div className="p-6 pt-20 pb-20 md:pb-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
