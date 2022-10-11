-- DB creation

CREATE DATABASE scubr;

-- Table creation

-- Add wallet id, see if a password & email is required
CREATE TABLE IF NOT EXISTS accounts (
  account_id BIGSERIAL PRIMARY KEY,
  public_address VARCHAR(255) NOT NULL UNIQUE,
  nonce VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  bio VARCHAR(1024) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  followers INTEGER DEFAULT 0,
  followings INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  video_id BIGSERIAL PRIMARY KEY,
  video_url VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  caption VARCHAR(255) NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  creator_id BIGINT REFERENCES accounts (account_id),
  owner_id BIGINT REFERENCES accounts (account_id),
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_uri (
  video_id BIGINT REFERENCES videos (video_id) ON DELETE CASCADE,
  video_url VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  caption VARCHAR(255),
  royalties INTEGER,
  creator_id INTEGER REFERENCES accounts (account_id),
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos_marketplace (
  video_id BIGINT REFERENCES videos (video_id) ON DELETE CASCADE,
  is_nft BOOLEAN DEFAULT false,
  on_sale BOOLEAN DEFAULT false,
  sale_price INTEGER,
  royalties INTEGER,
);

CREATE TABLE IF NOT EXISTS marketplace_history (
  video_id BIGINT REFERENCES videos (video_id) ON DELETE CASCADE,
  buyer BIGINT REFERENCES accounts (account_id),
  seller BIGINT REFERENCES accounts (account_id),
  sale_price INTEGER,
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos_awards (
  video_id BIGINT REFERENCES videos (video_id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES accounts (account_id),
  award_id INTEGER NOT NULL,
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos_likes (
  video_id BIGINT REFERENCES videos (video_id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES accounts (account_id),
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos_saves (
  video_id BIGINT REFERENCES videos (video_id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES accounts (account_id),
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos_comments (
  video_id BIGINT REFERENCES videos (video_id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES accounts (account_id),
  comment VARCHAR(255) NOT NULL,
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos_owners (
  video_id BIGINT REFERENCES videos (video_id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES accounts (account_id),
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts_followings (
  follower_id BIGINT REFERENCES accounts (account_id), -- The one who is following
  followee_id BIGINT REFERENCES accounts (account_id), -- The one who is being followed
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts_currentdatemetrics (
  account_id BIGINT REFERENCES accounts (account_id),
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts_pastmetrics (
  account_id INTEGER REFERENCES accounts (account_id),
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  metrics_date DATE NOT NULL,
  earned BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts_wallet (
  account_id INTEGER REFERENCES accounts (account_id),
  internal_wallet_address VARCHAR(255) NOT NULL UNIQUE,
  balance BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts_staking (
  staking_id BIGSERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts (account_id),
  amount BIGINT NOT NULL,
  duration INT NOT NULL,
  is_withdrawn BOOLEAN DEFAULT false,
  creation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Remove all tables

DROP TABLE videos_likes;
DROP TABLE videos_saves;
DROP TABLE videos_comments;
DROP TABLE videos_owners;
DROP TABLE accounts_followings;
DROP TABLE accounts_currentdatemetrics;
DROP TABLE accounts_pastmetrics;
DROP TABLE accounts_wallet;
DROP TABLE videos;
DROP TABLE accounts;