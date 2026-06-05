import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLists } from "@/lib/lists";
import { getMembershipForUser } from "@/lib/households";
import Lists from "../Lists";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const user = await requireUser();
  const [lists, membership] = await Promise.all([
    getLists(user.id),
    getMembershipForUser(user.id),
  ]);

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Lists</h1>
        <p className="note">
          Shopping, packing and anything else. Share a list with your family and
          everyone can add and tick things off.
        </p>
      </div>
      <Lists initialLists={lists} hasFamily={!!membership} />
    </>
  );
}
