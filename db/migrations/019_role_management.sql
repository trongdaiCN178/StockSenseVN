CREATE TABLE role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role text NOT NULL CHECK (requested_role = 'analyst'),
  organization text NOT NULL,
  position text NOT NULL,
  work_email text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX role_requests_user_idx ON role_requests(user_id, created_at DESC);
CREATE INDEX role_requests_status_idx ON role_requests(status, created_at DESC);
-- BR-R13: at most one pending request per user, enforced at the database level.
CREATE UNIQUE INDEX role_requests_one_pending_idx ON role_requests(user_id) WHERE status = 'pending_review';
