import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-page">
      <h1>Page not found</h1>
      <p className="note">That page doesn&apos;t exist (or moved).</p>
      <Link className="btn-primary-lg" href="/">
        Go home
      </Link>
    </div>
  );
}
