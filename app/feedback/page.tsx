import Link from "next/link";
import { requireUser } from "@/lib/auth";
import FeedbackForm from "../FeedbackForm";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  await requireUser();
  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Send feedback</h1>
      </div>
      <section className="panel">
        <FeedbackForm />
      </section>
    </>
  );
}
