const config = require('config');
const express = require('express');
const router = express.Router();

// Custom Imports
const pool = require('../db');

// Middlewares
const authMiddleware = require('../middlewares/auth');

router.delete('/remove_video', authMiddleware, async (req, res) => {
  try {
    // Check if publicAddress = mine
    const { publicAddress } = req.user;
    console.log(publicAddress, config.get('myPublicAddress'));
    if (publicAddress != config.get('myPublicAddress'))
      return res
        .status(403)
        .send({ error: 'You are not authorized to perform this operation' });

    // Check if the video id exists
    const { videoId } = req.body;
    const videoQuery = await pool.query(
      'SELECT * FROM videos WHERE video_id = $1',
      [videoId]
    );
    if (videoQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Video not found' });

    // Cascade delete the video and return with 204 status
    await pool.query('DELETE FROM videos WHERE video_id = $1', [videoId]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

module.exports = router;
