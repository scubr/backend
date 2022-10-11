const express = require('express');
const router = express.Router();
const Joi = require('joi');

// Custom Imports
const pool = require('../db');

// Middlewares
const authMiddleware = require('../middlewares/auth');

// get browse catalogue
router.get('/browse', authMiddleware, async (req, res) => {
  try {
    const browseQuery = await pool.query(
      `SELECT 
      v.video_id, v.video_url, v.title, v.creation_timestamp, v.name,
      vm.sale_price,
      vm.royalties
    FROM videos v JOIN accounts a ON v.owner_id = a.account_id AND videos v JOIN videos_marketplace vm ON v.video_id = vm.video_id
    WHERE vm.on_sale = true`,
      []
    );
    const browseDetails = browseQuery.rows;
    return res.status(200).send(browseDetails);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// get inventory catalogue
router.get('/inventory', authMiddleware, async (req, res) => {
  try {
    ownerId = req.user.accountId;
    const inventoryQuery = await pool.query(
      `SELECT 
        v.video_id, v.video_url, v.title, v.creation_timestamp, v.name,
        vm.sale_price,
        vm.royalties,
        vm.is_nft,
        vm.on_sale
      FROM videos v JOIN accounts a ON v.owner_id = a.account_id AND videos v JOIN videos_marketplace vm ON v.video_id = vm.video_id
      WHERE v.owner_id = $1`,
      [onwerId]
    );
    const inventoryDetails = inventoryQuery.rows;
    return res.status(200).send(inventoryDetails);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// get NFT details
router.get('/:id/details', authMiddleware, async (req, res) => {
  try {
    // Check if the video exists
    const videoId = req.params.id;
    const { accountId: userId } = req.user;
    const videoQuery = await pool.query(
      `SELECT 
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
    WHERE video_id = $2`,
      [userId, videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });
    // Return the video details
    const saleHistory = await pool.query(
      `SELECT buyer, seller, sale_price, creation_timestamp FROM marketplace_history WHERE video_id = $1`,
      [videoId]
    );
    const newOutput = (videoQuery.rows[0]['sales'] = saleHistory.rows);

    return res.status(200).send(newOutput);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Cancel sale
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    videoId = req.params.id;
    // Update videos -> owner_id
    await pool.query(
      `UPDATE videos_marketplace 
      SET on_sale = false, sale_price = null
      WHERE video_id = $1`,
      [videoId]
    );
    return res.status(200).send('Success, Sale Cancelled');
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// List NFT
router.post('/:id/list', authMiddleware, async (req, res) => {
  try {
    videoId = req.params.id;
    const { salePrice } = req.body;
    // Update videos -> owner_id
    await pool.query(
      `UPDATE videos_marketplace 
      SET on_sale = true, sale_price = $1
      WHERE video_id = $2`,
      [salePrice, videoId]
    );
    return res.status(200).send('Success, Listed');
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Mint NFT
router.post('/:id/mint', authMiddleware, async (req, res) => {
  try {
    videoId = req.params.id;
    const { royalties, videoUrl, title, caption, creatorId } = req.body;
    // Update videos -> owner_id
    await pool.query(
      `UPDATE videos_marketplace 
      SET is_nft = true, royalties = $1
      WHERE video_id = $2`,
      [royalties, videoId]
    );

    await pool.query(
      'INSERT INTO token_uri(video_id, video_url, title, caption, royalties, creator_id) VALUES($1, $2, $3, $4, $5, $6)',
      [videoId, videoUrl, title, caption, royalties, creatorId]
    );

    return res.status(200).send('Success, Minted');
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Burn NFT
router.post('/:id/burn', authMiddleware, async (req, res) => {
  try {
    videoId = req.params.id;
    const { royalties } = req.body;
    // Update videos -> owner_id
    await pool.query(
      `UPDATE videos_marketplace 
      SET is_nft = false, royalties = null
      WHERE video_id = $1`,
      [videoId]
    );

    await pool.query(`DELETE FROM token_uri WHERE video_id = $1`, [videoId]);
    return res.status(200).send('Success, Burned');
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Buy NFT
router.post('/:id/buy', authMiddleware, async (req, res) => {
  try {
    videoId = req.params.id;
    const { buyer, seller, salePrice } = req.body;
    // Update videos -> owner_id
    await pool.query(
      `UPDATE videos 
      SET owner_id = $1
      WHERE video_id = $2`,
      [buyer, videoId]
    );
    // Update videos_marketplace -> on_sale, sale_price
    await pool.query(
      `UPDATE videos_marketplace 
      SET on_sale = false, sale_price = null
      WHERE video_id = $1`,
      [videoId]
    );
    // Insert in marketplace history
    const insertQuery = await pool.query(
      'INSERT INTO marketplace_history(video_id, buyer, seller, sale_price) VALUES($1, $2, $3, $4)',
      [videoId, buyer, seller, salePrice]
    );

    return res.status(200).send('Success, Bought');
  } catch (error) {
    return res.status(500).send({ error });
  }
});

module.exports = router;
