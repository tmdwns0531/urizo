-- v0.9 accounts and watchlist. Additive only; existing migrations stay immutable.
--
-- Login exists solely so a watchlist can belong to someone. The anonymous
-- recommendation path never reads these tables, and catalog eligibility stays
-- independent of any account.
BEGIN;

CREATE TABLE "accounts" (
  "id"            VARCHAR(64)  NOT NULL,
  "nickname"      VARCHAR(12)  NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "birth_date"    DATE         NOT NULL,
  "created_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- The nickname is the login key, so it must be unique.
CREATE UNIQUE INDEX "accounts_nickname_key" ON "accounts" ("nickname");

-- Never store a plaintext password. The application writes
-- `pbkdf2$<iterations>$<salt>$<hash>`; this check keeps a future code path from
-- silently downgrading that.
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_password_hash_format_check"
  CHECK ("password_hash" LIKE 'pbkdf2$%$%$%');

CREATE TABLE "watchlist_items" (
  "id"         VARCHAR(64) NOT NULL,
  "account_id" VARCHAR(64) NOT NULL,
  "content_id" VARCHAR(64) NOT NULL,
  "saved_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- Saving the same title twice is not an error; it stays one row.
CREATE UNIQUE INDEX "watchlist_items_account_content_key"
  ON "watchlist_items" ("account_id", "content_id");

CREATE INDEX "watchlist_items_account_saved_idx"
  ON "watchlist_items" ("account_id", "saved_at");

-- Deleting an account removes its watchlist. Deactivating a catalog row keeps
-- the entry, but a hard delete removes it so no row points at a missing title.
ALTER TABLE "watchlist_items"
  ADD CONSTRAINT "watchlist_items_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watchlist_items"
  ADD CONSTRAINT "watchlist_items_content_id_fkey"
  FOREIGN KEY ("content_id") REFERENCES "catalog_contents" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
