import { redirect } from "next/navigation";

// Short URL redirect: /t/{egpId} → /tenders/{egpId}
// Used in LINE notifications to keep messages compact
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  redirect(`/tenders/${id}`);
}
