import Link from "next/link";
import { requireUser, getPasswordHash } from "@/lib/auth";
import { ensureInboundAddress } from "@/lib/users";
import ProfileForm from "../ProfileForm";
import DeleteAccount from "../DeleteAccount";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const hasPassword = Boolean(await getPasswordHash(user.id));
  const inbound = await ensureInboundAddress(user);

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Profile</h1>
      </div>
      <ProfileForm
        initialName={user.name ?? ""}
        initialEmail={user.email}
        hasPassword={hasPassword}
      />
      {inbound && (
        <div className="profile-form" style={{ marginTop: 16 }}>
          <section className="profile-card">
            <h2 className="section">Your email-in address</h2>
            <p className="note">
              Forward or send any email here and nudge turns it into tasks.
            </p>
            <code className="inbound-addr">{inbound}</code>
          </section>
        </div>
      )}
      <DeleteAccount />
    </>
  );
}
