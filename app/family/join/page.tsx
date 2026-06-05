import { getCurrentUser } from "@/lib/auth";
import { getInvite } from "@/lib/households";
import InviteAccept from "../../InviteAccept";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invite = token ? await getInvite(token) : null;
  const user = await getCurrentUser();

  return (
    <div className="auth-wrap">
      <div className="greeting">
        <h1>{invite ? `Join “${invite.householdName}”` : "Family invite"}</h1>
      </div>
      <InviteAccept
        token={token ?? ""}
        householdName={invite?.householdName ?? null}
        loggedIn={Boolean(user)}
        invitedEmail={invite?.email ?? null}
      />
    </div>
  );
}
