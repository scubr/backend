const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { default: axios } = require('axios');

// Custom Imports
const pool = require('../db');

// Middlewares
const authMiddleware = require('../middlewares/auth');

// Get signed url for upload
router.get('/get_url', authMiddleware, async (req, res) => {
  try {
    const result = await axios({
      method: 'POST',
      url: 'https://api.thetavideoapi.com/upload',
      headers: {
        'x-tva-sa-id': 'srvacc_gn9qzb0i870c332y3gq036mec',
        'x-tva-sa-secret': '2782q7rcme8tsd07j66s14ja2ychj2s4',
      },
    });
    return res.status(200).send(result.data.body.uploads[0]);
  } catch (error) {
    console.log(error);
    return res.status(400).send({ error });
  }
});

// Trancode a video using the upload
router.post('/transcode', authMiddleware, async (req, res) => {
  try {
    const { sourceUpload: source_upload_id, playbackPolicy: playback_policy } =
      req.body;
    const result = await axios({
      method: 'POST',
      url: 'https://api.thetavideoapi.com/video',
      headers: {
        'x-tva-sa-id': 'srvacc_gn9qzb0i870c332y3gq036mec',
        'x-tva-sa-secret': '2782q7rcme8tsd07j66s14ja2ychj2s4',
        'Content-Type': 'application/json',
      },
      data: {
        source_upload_id,
        playback_policy,
      },
    });
    return res.status(200).send(result.data.body.videos[0]);
  } catch (error) {
    console.log(error);
    return res.status(400).send({ error });
  }
});

// Check progress of video upload
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const { videoId } = req.query;
    const result = await axios({
      method: 'GET',
      url: `https://api.thetavideoapi.com/video/${videoId}`,
      headers: {
        'x-tva-sa-id': 'srvacc_gn9qzb0i870c332y3gq036mec',
        'x-tva-sa-secret': '2782q7rcme8tsd07j66s14ja2ychj2s4',
      },
    });
    return res.status(200).send(result.data.body.videos[0]);
  } catch (error) {
    console.log(error);
    return res.status(400).send({ error });
  }
});

// Upload and get video url
router.post('/new', async (req, res) => {
  try {
    const videoData = req.body;
    // console.log(videoData);
    // return res.status(201).send('hi');
    // console.log(videoData);
    const urlQuery = await axios({
      method: 'POST',
      url: 'https://api.thetavideoapi.com/upload',
      headers: {
        'x-tva-sa-id': 'srvacc_gn9qzb0i870c332y3gq036mec',
        'x-tva-sa-secret': '2782q7rcme8tsd07j66s14ja2ychj2s4',
      },
    });

    // console.log('urlQuery ', urlQuery);
    const { id: source_upload_id, presigned_url: presignedUrl } =
      urlQuery.data.body.uploads[0];
    // console.log(videoUploadId, presignedUrl);
    const videoUploadQuery = await axios({
      method: 'PUT',
      url: presignedUrl,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      data: videoData,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // console.log('videoQuery ', videoUploadQuery);

    const transcodeQuery = await axios({
      method: 'POST',
      url: 'https://api.thetavideoapi.com/video',
      headers: {
        'x-tva-sa-id': 'srvacc_gn9qzb0i870c332y3gq036mec',
        'x-tva-sa-secret': '2782q7rcme8tsd07j66s14ja2ychj2s4',
        'Content-Type': 'application/json',
      },
      data: {
        source_upload_id,
        playback_policy: 'public',
      },
    });

    const resultData = transcodeQuery.data.body.videos[0];
    resultData.video_url = `https://media.thetavideoapi.com/${resultData.id}/master.m3u8`;

    return res.status(200).send(resultData);
  } catch (error) {
    console.log(error);
    return res.status(500).send({ error });
  }
});

// Get all videos (feed)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Sort by recent
    const { sort } = req.query;
    const { accountId: userId } = req.user;
    console.log(userId);
    if (sort == 'recent') {
      const videoQuery = await pool.query(
        `SELECT 
        v.video_id, v.video_url, v.title, v.caption, v.views, v.likes, v.comments, v.creation_timestamp, v.creator_id, v.owner_id, a.name, a.image_url,
        vm.is_nft,
        vm.on_sale,
        vm.sale_price,
        vm.royalties,
        (SELECT COUNT(*) FROM videos_awards vaw WHERE vaw.video_id = v.video_id) AS total_awards,
        (EXISTS (SELECT * FROM videos_likes vl WHERE vl.video_id = v.video_id AND vl.account_id = $1 )) AS liked, 
        (EXISTS (SELECT * FROM videos_saves vs WHERE vs.video_id = v.video_id AND vs.account_id = $1 )) AS saved, 
        (EXISTS (SELECT * FROM accounts_followings af WHERE af.followee_id = a.account_id AND af.follower_id = $1 )) AS following 
      FROM videos v JOIN accounts a ON v.owner_id = a.account_id AND videos v JOIN videos_marketplace vm ON v.video_id = vm.video_id
      WHERE v.owner_id <> $1 ORDER BY v.creation_timestamp DESC`,
        [userId]
      );
      return res.status(200).send(videoQuery.rows);
    }

    // Sort by top
    if (sort == 'top') {
      const videoQuery = await pool.query(
        'SELECT video_id, video_url, title, caption, views, likes, comments, is_nft, on_sale, v.creation_timestamp, creator_id, owner_id, name, image_url, (EXISTS (SELECT * FROM videos_likes vl WHERE vl.video_id = v.video_id AND vl.account_id = $1 )) AS liked, (EXISTS (SELECT * FROM videos_saves vs WHERE vs.video_id = v.video_id AND vs.account_id = $1 )) AS saved, (EXISTS (SELECT * FROM accounts_followings af WHERE af.followee_id = a.account_id AND af.follower_id = $1 )) AS following FROM videos v JOIN accounts a ON v.owner_id = a.account_id WHERE v.owner_id <> $1 ORDER BY likes DESC, views DESC, comments DESC'
      );
      return res.status(200).send(videoQuery.rows);
    }

    // Return 400 error incase of wrong sort option
    return res.status(400).send({ error: 'Sort should be recent or top' });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ error });
  }
});

// Upload a video
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log(req.body);
    // Input validation
    const { error } = validateVideo(req.body);
    if (error) return res.status(400).send({ error: error.message });

    // Create a new video
    const { videoUrl, title } = req.body;

    const { accountId } = req.user;
    const insertQuery = await pool.query(
      'INSERT INTO videos(video_url, title, caption, creator_id, owner_id) VALUES($1, $2, $3, $4, $5) RETURNING *',
      [videoUrl, title, caption, accountId, accountId]
    );

    // Update it in videos_owner table
    const newVideo = insertQuery.rows[0];
    await pool.query(
      'INSERT INTO videos_owners(video_id, account_id) VALUES($1, $2)',
      [newVideo.video_id, newVideo.creator_id]
    );

    // Update it in videos_marketplace table
    const videoMarketplace = insertQuery.rows[0];
    await pool.query('INSERT INTO videos_marketplace(video_id) VALUES($1)', [
      newVideo.video_id,
    ]);

    // TODO: add 10 xp to
    await pool.query('UPDATE accounts SET xp = xp+10 WHERE account_id = $1', [
      accountId,
    ]);

    // Send the data back
    res.status(201).send(newVideo);
  } catch (error) {
    console.log(error);
    return res.status(500).send({ error });
  }
});

// Get video details by id
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
    return res.status(200).send(videoQuery.rows[0]);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Post an award to a video --------------------------------------------------------

// Get videos awards by video id
router.get('/:id/awards', authMiddleware, async (req, res) => {
  try {
    // Check if the video exists
    const videoId = req.params.id;
    const { accountId: userId } = req.user;
    const videoQuery = await pool.query(
      `SELECT 
      COUNT(account_id), award_id
      FROM awards
      WHERE video_id = $1
      GROUP BY award_id`,
      [videoId]
    );

    // Return the video details
    return res.status(200).send(videoQuery.rows);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// View a video
router.post('/:id/view', authMiddleware, async (req, res) => {
  try {
    // Check if the video exists
    const videoId = req.params.id;
    const accountId = req.user.accountId;
    const videoQuery = await pool.query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });
    // Add 1 view to the video
    await pool.query('UPDATE videos SET views = views+1 WHERE video_id = $1', [
      videoId,
    ]);
    // Add 1 view to the video owner account
    const ownerAccountId = videoQuery.rows[0].owner_id;
    await pool.query(
      'UPDATE accounts SET total_views = total_views+1 WHERE account_id = $1',
      [ownerAccountId]
    );
    // Add 1 xp to the viewer account
    await pool.query('UPDATE accounts SET xp = xp+1 WHERE account_id = $1', [
      accountId,
    ]);

    await pool.query(
      'UPDATE accounts_currentdatemetrics SET views = views+1 WHERE account_id = $1',
      [accountId]
    );

    // Return with status 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Like a video
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    // Check if the video exists
    const videoId = req.params.id;
    const accountId = req.user.accountId;
    const videoQuery = await pool.query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });

    // Check if already liked
    const likeQuery = await pool.query(
      'SELECT * FROM videos_likes WHERE video_id = $1 AND account_id = $2',
      [videoId, accountId]
    );
    if (likeQuery.rowCount > 0)
      return res.status(400).send({ error: 'The video is already liked' });

    // Update in videos_likes table
    await pool.query(
      'INSERT INTO videos_likes(video_id, account_id) VALUES($1, $2)',
      [videoId, accountId]
    );

    // Add 1 like to the video
    await pool.query('UPDATE videos SET likes = likes+1 WHERE video_id = $1', [
      videoId,
    ]);

    // Add 1 like to the video owner account
    const ownerAccountId = videoQuery.rows[0].owner_id;
    await pool.query(
      'UPDATE accounts SET total_likes = total_likes+1 WHERE account_id = $1',
      [ownerAccountId]
    );

    // Add 2 xp to the liker account
    await pool.query('UPDATE accounts SET xp = xp+2 WHERE account_id = $1', [
      accountId,
    ]);

    await pool.query(
      'UPDATE accounts_currentdatemetrics SET likes = likes+1 WHERE account_id = $1',
      [accountId]
    );

    // Return with status 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Unlike a video
router.post('/:id/unlike', authMiddleware, async (req, res) => {
  try {
    // Check if the video exists
    const videoId = req.params.id;
    const accountId = req.user.accountId;
    const videoQuery = await pool.query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });

    // Check if already unliked
    const likeQuery = await pool.query(
      'SELECT * FROM videos_likes WHERE video_id = $1 AND account_id = $2',
      [videoId, accountId]
    );
    if (likeQuery.rowCount <= 0)
      return res.status(400).send({ error: 'The video is already unliked' });

    // Update in videos_likes table
    await pool.query(
      'DELETE FROM videos_likes WHERE video_id = $1 AND account_id = $2',
      [videoId, accountId]
    );

    // Remove 1 like to the video
    await pool.query('UPDATE videos SET likes = likes-1 WHERE video_id = $1', [
      videoId,
    ]);

    // Remove 1 like to the video owner account
    const ownerAccountId = videoQuery.rows[0].owner_id;
    await pool.query(
      'UPDATE accounts SET total_likes = total_likes-1 WHERE account_id = $1',
      [ownerAccountId]
    );

    // Return with status 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Save a video
router.post('/:id/save', authMiddleware, async (req, res) => {
  try {
    // Check if the video exists
    const videoId = req.params.id;
    const accountId = req.user.accountId;
    const videoQuery = await pool.query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });

    // Check if already saved
    const saveQuery = await pool.query(
      'SELECT * FROM videos_saves WHERE video_id = $1 AND account_id = $2',
      [videoId, accountId]
    );
    if (saveQuery.rowCount > 0)
      return res.status(400).send({ error: 'The video is already saved' });

    // Update in videos_saves table
    await pool.query(
      'INSERT INTO videos_saves(video_id, account_id) VALUES($1, $2)',
      [videoId, accountId]
    );

    // Return with status 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Unsave a video
router.post('/:id/unsave', authMiddleware, async (req, res) => {
  try {
    // Check if the video exists
    const videoId = req.params.id;
    const accountId = req.user.accountId;
    const videoQuery = await pool.query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });

    // Check if already unsaved
    const saveQuery = await pool.query(
      'SELECT * FROM videos_saves WHERE video_id = $1 AND account_id = $2',
      [videoId, accountId]
    );
    if (saveQuery.rowCount <= 0)
      return res.status(400).send({ error: 'The video is already unsaved' });

    // Update in videos_saves table
    await pool.query(
      'DELETE FROM videos_saves WHERE video_id = $1 AND account_id = $2',
      [videoId, accountId]
    );

    // Return with status 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Comment on a video
router.post('/:id/comment', authMiddleware, async (req, res) => {
  try {
    // Input validation
    const { error } = validateComment(req.body);
    if (error) return res.status(400).send({ error: error.message });

    // Check if the video exists
    const videoId = req.params.id;
    const accountId = req.user.accountId;
    const comment = req.body.comment;
    const videoQuery = await pool.query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });

    // Update in videos_comments table
    await pool.query(
      'INSERT INTO videos_comments(video_id, account_id, comment) VALUES($1, $2, $3)',
      [videoId, accountId, comment]
    );

    // Add 1 comment to the video
    await pool.query(
      'UPDATE videos SET comments = comments+1 WHERE video_id = $1',
      [videoId]
    );

    // Add 3 xp to the commenter account
    await pool.query('UPDATE accounts SET xp = xp+3 WHERE account_id = $1', [
      accountId,
    ]);

    // Return with status 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Get all comments on a video
router.get('/:id/comments', authMiddleware, async (req, res) => {
  try {
    // Check if the video exists
    const videoId = req.params.id;
    const videoQuery = await pool.query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });

    // Return all the comments
    const commentQuery = await pool.query(
      'SELECT vc.account_id, vc.video_id, vc.comment, vc.creation_timestamp, a.name, a.image_url FROM videos_comments vc JOIN accounts a ON vc.account_id = a.account_id WHERE vc.video_id = $1 ORDER BY vc.creation_timestamp DESC',
      [videoId]
    );
    const comments = commentQuery.rows;
    return res.status(200).send(comments);
  } catch (error) {
    // console.log(error);
    return res.status(500).send({ error });
  }
});

const validateVideo = (video) => {
  const schema = Joi.object({
    videoUrl: Joi.string().uri().max(255).required(),
    title: Joi.string().max(255).required(),
    caption: Joi.string().max(255).required(),
  });

  return schema.validate(video);
};

const validateComment = (comment) => {
  const schema = Joi.object({
    comment: Joi.string().max(255).required(),
  });

  return schema.validate(comment);
};

module.exports = router;
