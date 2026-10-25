CREATE TABLE investment_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  capital_vnd numeric(20, 2) NOT NULL CHECK (capital_vnd > 0 AND capital_vnd <= 1000000000000000),
  risk_pct numeric(8, 4) NOT NULL CHECK (risk_pct > 0 AND risk_pct <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
