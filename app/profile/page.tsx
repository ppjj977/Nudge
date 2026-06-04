import Link from "next/link";
import { requireUser, getPasswordHash } from "@/lib/auth";
import ProfileForm from "../ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const hasPassword = Boolean(await getPasswordHash(user.id));

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
    </>
  );
}
