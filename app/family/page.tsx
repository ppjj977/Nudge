import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMembershipForUser, getMembers } from "@/lib/households";
import FamilyManager from "../FamilyManager";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const user = await requireUser();
  const membership = await getMembershipForUser(user.id);
  const members = membership ? await getMembers(membership.household.id) : [];

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Family</h1>
      </div>
      <FamilyManager
        household={membership?.household ?? null}
        members={members}
        meId={user.id}
      />
    </>
  );
}
