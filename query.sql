SELECT 
  v.video_id, v.video_url, v.title, v.caption, v.views, v.likes, v.comments, v.creation_timestamp, v.creator_id, v.owner_id, v.name, v.image_url,
  vm.is_nft,
  vm.on_sale,
  vm.sale_price,
  vm.royalties,
  (SELECT COUNT(*) FROM videos_awards vaw WHERE vaw.video_id = v.video_id) AS total_awards,
  (EXISTS (SELECT * FROM videos_likes vl WHERE vl.video_id = v.video_id AND vl.account_id = $1 )) AS liked, 
  (EXISTS (SELECT * FROM videos_saves vs WHERE vs.video_id = v.video_id AND vs.account_id = $1 )) AS saved, 
  (EXISTS (SELECT * FROM accounts_followings af WHERE af.followee_id = a.account_id AND af.follower_id = $1 )) AS following 
FROM videos v JOIN accounts a ON v.owner_id = a.account_id AND videos v JOIN videos_marketplace vm ON v.video_id = vm.video_id
WHERE v.owner_id <> $1 ORDER BY v.creation_timestamp DESC


SELECT 
  video_id, video_url, title, caption, views, likes, comments, v.creation_timestamp, creator_id, owner_id, name, image_url, 
  vm.is_nft,
  vm.on_sale,
  vm.sale_price,
  vm.royalties,
  (SELECT COUNT(*) FROM videos_awards vaw WHERE vaw.video_id = v.video_id) AS total_awards,
  (EXISTS (SELECT * FROM videos_likes vl WHERE vl.video_id = v.video_id AND vl.account_id = $1 )) AS liked, 
  (EXISTS (SELECT * FROM videos_saves vs WHERE vs.video_id = v.video_id AND vs.account_id = $1 )) AS saved, 
  (EXISTS (SELECT * FROM accounts_followings af WHERE af.followee_id = a.account_id AND af.follower_id = $1 )) AS following 
FROM videos v JOIN accounts a ON v.owner_id = a.account_id AND videos v JOIN videos_marketplace vm ON v.video_id = vm.video_id
WHERE video_id = $2

SELECT 
    COUNT(account_id), award_id
    FROM videos v JOIN awards a ON v.video_id = a.video_id
    WHERE video_id = $1
    GROUP BY award_id


-- Wallet details
SELECT
  internal_wallet_address, balance
FROM accounts_wallet
WHERE account_id = $1

SELECT
  balance
FROM accounts_wallet
WHERE account_id = $1

SELECT *
FROM accounts_pastmetrics
WHERE account_id = $1
ORDER BY metrics_date DESC

INSERT INTO accounts_staking(account_id, amount, duration) VALUES($1, $2, $3) RETURNING *

UPDATE accounts_staking SET is_withdrawn = true WHERE staking_id = $1 RETURNING *

SELECT * FROM accounts_staking WHERE account_id = $1

SELECT 
  v.video_id, v.video_url, v.title, v.creation_timestamp, v.name,
  vm.sale_price,
  vm.royalties
FROM videos v JOIN accounts a ON v.owner_id = a.account_id AND videos v JOIN videos_marketplace vm ON v.video_id = vm.video_id
WHERE v.owner_id <> $1 ORDER BY v.creation_timestamp DESC

SELECT 
    v.video_id, v.video_url, v.title, v.creation_timestamp, v.name,
    vm.sale_price,
    vm.royalties,
    vm.is_nft,
    vm.on_sale
  FROM videos v JOIN accounts a ON v.owner_id = a.account_id AND videos v JOIN videos_marketplace vm ON v.video_id = vm.video_id
  WHERE v.owner_id = $1

UPDATE videos 
    owner_id = $1
  FROM videos
  WHERE video_id = $2

SELECT buyer, seller, sale_price, creation_timestamp FROM marketplace_history WHERE video_id = $1