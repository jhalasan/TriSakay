import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

/** P2 (2026-09-15 launch audit): the app previously had no 404 — App.tsx's
 * catch-all route silently redirected any unmatched URL straight to "/",
 * indistinguishable from a permission denial or a typo. This gives a
 * mistyped or stale URL an actual page instead of a silent bounce. */
export function NotFound() {
  return (
    <div className="page">
      <EmptyState
        message="Page not found."
        hint="The page you're looking for doesn't exist or has moved."
        action={<Link to="/">Back to Dashboard</Link>}
      />
    </div>
  );
}
