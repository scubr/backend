const express = require('express');
const router = express.Router();
const Joi = require('joi');

// Custom Imports
const pool = require('../db');

// Middlewares
const authMiddleware = require('../middlewares/auth');

// Search videos (top 10)
router.get('/videos', authMiddleware, async (req, res) => {
  try {
    // Input validation
    const { error } = validateTerm(req.query);
    const term = req.query.term;
    if (error) return res.status(400).send({ error: error.message });

    // Search and return the results
    const searchQuery = await pool.query(
      'SELECT video_id, video_url, title, views, likes FROM videos WHERE LOWER(title) LIKE LOWER($1) ORDER BY likes DESC, views DESC LIMIT 10',
      ['%' + term + '%']
    );
    const searchResults = searchQuery.rows;
    return res.status(200).send(searchResults);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Search accounts (top 10)
router.get('/accounts', authMiddleware, async (req, res) => {
  try {
    // Input validation
    const { error } = validateTerm(req.query);
    const term = req.query.term;
    if (error) return res.status(400).send({ error: error.message });
    // Search and return the results
    const searchQuery = await pool.query(
      'SELECT account_id, name, image_url, followers, xp FROM accounts WHERE LOWER(name) LIKE LOWER($1) ORDER BY total_likes DESC, total_views DESC LIMIT 10',
      ['%' + term + '%']
    );
    const searchResults = searchQuery.rows;
    return res.status(200).send(searchResults);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// top accounts and videos (top 10)
router.get('/top', authMiddleware, async (req, res) => {
  try {
    // Return top accounts and videos
    const { accountId: userId } = req.user;

    const accountsQuery = await pool.query(
      'SELECT account_id, name, image_url, xp, (EXISTS (SELECT * FROM accounts_followings af WHERE af.followee_id = account_id AND af.follower_id = $1 )) AS following FROM accounts WHERE account_id <> $1 ORDER BY total_likes DESC, total_views DESC, followers DESC, xp DESC LIMIT 10',
      [userId]
    );

    const videosQuery = await pool.query(
      'SELECT video_id, video_url, title FROM videos ORDER BY likes DESC, views DESC, comments DESC LIMIT 10'
    );

    const result = {};
    result.accounts = accountsQuery.rows;
    result.videos = videosQuery.rows;
    return res.status(200).send(result);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Joi validations
const validateTerm = (term) => {
  const schema = Joi.object({
    term: Joi.string().max(255).required(),
  });

  return schema.validate(term);
};

module.exports = router;
