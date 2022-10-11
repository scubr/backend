const express = require('express');
const router = express.Router();
const Joi = require('joi');
const _ = require('lodash');
const { recoverPersonalSignature } = require('eth-sig-util');
const { bufferToHex } = require('ethereumjs-util');

// Custom Imports
const pool = require('../db');
const { generateJwtToken } = require('../utils/collection');

// Middlewares
const authMiddleware = require('../middlewares/auth');

// Get nonce of an account
router.get('/nonce', async (req, res) => {
  try {
    // Check if the account id exists
    const publicAddress = req.query.publicAddress.toLowerCase();
    const nonceQuery = await pool.query(
      'SELECT nonce FROM accounts WHERE LOWER(public_address) = LOWER($1)',
      [publicAddress]
    );
    if (nonceQuery.rowCount <= 0)
      return res
        .status(400)
        .send({ error: 'Cannot fetch nonce for this account' });

    // Send the nonce
    return res.status(200).send(nonceQuery.rows[0]);
  } catch (error) {
    return res.status(400).send({ error });
  }
});

// Check if already registered
router.get('/', async (req, res) => {
  try {
    const { publicAddress } = req.query;
    const accountQuery = await pool.query(
      'SELECT * FROM accounts WHERE LOWER(public_address) = LOWER($1)',
      [publicAddress]
    );
    if (accountQuery.rowCount <= 0) return res.status(200).send(false);
    else return res.status(200).send(true);
  } catch (error) {
    console.log(error);
    return res.status(500).send({ error });
  }
});

// Create an account
router.post('/', async (req, res) => {
  try {
    // Input validation
    const { error } = validateAccount(req.body);
    if (error) return res.status(400).send({ error: error.message });

    // Check if the account is already present in the database
    const { publicAddress, name, bio, imageUrl, nonce, signature } = req.body;
    // console.log(req.body);
    const userQuery = await pool.query(
      'SELECT * FROM accounts WHERE LOWER(public_address) = LOWER($1)',
      [publicAddress]
    );

    if (userQuery.rowCount > 0)
      return res
        .status(400)
        .send({ error: 'User already exists for this wallet' });

    // Verify digital signature
    const msg = `I am signing my one-time nonce: ${nonce}`;
    const msgBufferHex = bufferToHex(Buffer.from(msg, 'utf8'));
    const address = recoverPersonalSignature({
      data: msgBufferHex,
      sig: signature,
    });

    if (address.toLowerCase() !== publicAddress.toLowerCase())
      return res
        .status(400)
        .send({ error: 'Digital signature verfication failed' });

    // Create a new user and send the jwt
    // Generate nonce for the account
    const newNonce = Math.floor(Math.random() * 1000000);
    const insertQuery = await pool.query(
      'INSERT INTO accounts(public_address, nonce, name, bio, image_url) VALUES($1, $2, $3, $4, $5) RETURNING *',
      [publicAddress, newNonce, name, bio, imageUrl]
    );

    const extractedResult = insertQuery.rows[0];

    const genRanHex = (size) =>
      [...Array(size)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');

    const internalWalletAddress = '0x' + genRanHex(16);

    const insertWallet = await pool.query(
      'INSERT INTO accounts_wallet(account_id, internal_wallet_address) VALUES($1, $2) RETURNING *',
      [extractedResult['account_id'], internalWalletAddress]
    );

    const insertCurrentMetrics = await pool.query(
      'INSERT INTO accounts_currentdatemetrics(account_id) VALUES($1) RETURNING *',
      [extractedResult['account_id']]
    );

    // create jwt and return it in response header
    const authToken = generateJwtToken(extractedResult);
    const sanitizedUser = _.pick(extractedResult, [
      'account_id',
      'public_address',
      'name',
      'bio',
      'image_url',
      'followers',
      'followings',
      'total_views',
      'total_likes',
      'xp',
    ]);
    return res
      .header('x-auth-token', authToken)
      .header('access-control-expose-headers', 'x-auth-token')
      .status(201)
      .send(sanitizedUser);
  } catch (error) {
    if (error.message == 'Invalid signature length')
      return res.status(400).send({ error: error.message });
    return res.status(500).send({ error });
  }
});

// Get account details by id
router.get('/:id/details', authMiddleware, async (req, res) => {
  try {
    // Check if account id exists
    const accountId = req.params.id;
    const { accountId: userId } = req.user;
    const accountQuery = await pool.query(
      'SELECT *, (EXISTS (SELECT * FROM accounts_followings af WHERE af.followee_id = account_id AND af.follower_id = $1 )) AS following FROM accounts WHERE account_id = $2',
      [userId, accountId]
    );
    if (accountQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Account not found' });

    // Return the account details
    const sanitizedUser = _.pick(accountQuery.rows[0], [
      'account_id',
      'name',
      'bio',
      'image_url',
      'followers',
      'followings',
      'total_views',
      'total_likes',
      'xp',
      'following',
      'public_address',
    ]);

    // return the account details
    return res.status(200).send(sanitizedUser);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Follow an account
router.post('/:id/follow', authMiddleware, async (req, res) => {
  try {
    // Check if the account is trying to follow self
    const followerId = req.user.accountId;
    const followeeId = req.params.id;
    if (followerId == followeeId)
      return res.status(400).send({ error: 'Cannot follow self' });

    // Check if followee account id exists
    const accountQuery = await pool.query(
      'SELECT * FROM accounts WHERE account_id = $1',
      [followeeId]
    );
    if (accountQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Account not found' });

    // Check if already following
    const followQuery = await pool.query(
      'SELECT * FROM accounts_followings WHERE follower_id = $1 AND followee_id = $2',
      [followerId, followeeId]
    );
    if (followQuery.rowCount > 0)
      return res
        .status(400)
        .send({ error: 'The account is already being followed' });

    // Follow
    await pool.query(
      'INSERT INTO accounts_followings(follower_id, followee_id) VALUES($1, $2)',
      [followerId, followeeId]
    );
    await pool.query(
      'UPDATE accounts SET followers = followers+1 WHERE account_id = $1',
      [followeeId]
    );
    await pool.query(
      'UPDATE accounts SET followings = followings+1 WHERE account_id = $1',
      [followerId]
    );

    // Respond with status 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Unfollow an account
router.post('/:id/unfollow', authMiddleware, async (req, res) => {
  try {
    // Check if unfollowee account id exists
    const unfollowerId = req.user.accountId;
    const unfolloweeId = req.params.id;
    // Check if account is trying to unfollow self
    if (unfollowerId == unfolloweeId)
      return res.status(400).send({ error: 'Cannot unfollow self' });
    const accountQuery = await pool.query(
      'SELECT * FROM accounts WHERE account_id = $1',
      [unfolloweeId]
    );
    if (accountQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Account not found' });

    // Check if already unfollowing
    const unfollowQuery = await pool.query(
      'SELECT * FROM accounts_followings WHERE follower_id = $1 AND followee_id = $2',
      [unfollowerId, unfolloweeId]
    );

    if (unfollowQuery.rowCount <= 0)
      return res
        .status(400)
        .send({ error: 'The account is already being unfollowed' });

    // Unfollow
    await pool.query(
      'DELETE FROM accounts_followings WHERE follower_id = $1 AND followee_id = $2',
      [unfollowerId, unfolloweeId]
    );
    await pool.query(
      'UPDATE accounts SET followers = followers-1 WHERE account_id = $1',
      [unfolloweeId]
    );
    await pool.query(
      'UPDATE accounts SET followings = followings-1 WHERE account_id = $1',
      [unfollowerId]
    );
    // Respond with status 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Get all liked videos
router.get('/:id/liked', authMiddleware, async (req, res) => {
  try {
    // Check if the account is the authenticated
    const accountId = req.params.id;
    if (req.user.accountId != accountId)
      return res
        .status(401)
        .send({ error: 'You are not authorized to perform this operation' });

    // Return all the liked video details in an array
    const likedQuery = await pool.query(
      'SELECT vl.video_id, v.video_url, v.views, v.likes, v.comments, v.title, v.caption FROM videos_likes vl JOIN videos v ON vl.video_id = v.video_id WHERE account_id = $1 ORDER BY vl.creation_timestamp DESC',
      [accountId]
    );
    return res.status(200).send(likedQuery.rows);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Get all saved videos
router.get('/:id/saved', authMiddleware, async (req, res) => {
  try {
    // Check if the account is authenticated to perform the operation
    const accountId = req.params.id;
    if (req.user.accountId != accountId)
      return res
        .status(401)
        .send({ error: 'You are not authorized to perform this operation' });

    // Return all the saved video details in an array
    const savedQuery = await pool.query(
      'SELECT vs.video_id, v.video_url, v.views, v.likes, v.comments, v.title, v.caption FROM videos_saves vs JOIN videos v ON vs.video_id = v.video_id WHERE account_id = $1 ORDER BY vs.creation_timestamp DESC',
      [accountId]
    );
    return res.status(200).send(savedQuery.rows);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Get all collected videos
router.get('/:id/owned', authMiddleware, async (req, res) => {
  try {
    // Check if the account with the id exists
    const accountId = req.params.id;
    const accountQuery = await pool.query(
      'SELECT * FROM accounts WHERE account_id = $1',
      [accountId]
    );
    if (accountQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Account not found' });

    // Return all the posted video details in an array
    const ownedQuery = await pool.query(
      'SELECT video_id, video_url, views, likes, comments, title, caption FROM videos WHERE owner_id = $1 ORDER BY creation_timestamp DESC',
      [accountId]
    );
    return res.status(200).send(ownedQuery.rows);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Get all created videos
router.get('/:id/created', authMiddleware, async (req, res) => {
  try {
    // Check if the account with the id exists
    const accountId = req.params.id;
    const accountQuery = await pool.query(
      'SELECT * FROM accounts WHERE account_id = $1',
      [accountId]
    );
    if (accountQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Account not found' });

    // Return all the posted video details in an array
    const createdQuery = await pool.query(
      'SELECT video_id, video_url, views, likes, comments, title, caption FROM videos WHERE creator_id = $1 AND ownder_id = $1 ORDER BY creation_timestamp DESC',
      [accountId]
    );
    return res.status(200).send(createdQuery.rows);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Get all followers
router.get('/:id/followers', authMiddleware, async (req, res) => {
  try {
    // Check if the account is authenticated to perform the operation
    // const accountId = req.params.id;
    // if (req.user.accountId != accountId)
    //   return res
    //     .status(401)
    //     .send({ error: 'You are not authorized to perform this operation' });

    // Return all the followers
    const followersQuery = await pool.query(
      'SELECT af.follower_id, a.name, a.image_url FROM accounts_followings af JOIN accounts a ON af.follower_id = a.account_id WHERE af.followee_id = $1 ORDER BY af.creation_timestamp DESC',
      [accountId]
    );
    return res.status(200).send(followersQuery.rows);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Get all followings
router.get('/:id/followings', authMiddleware, async (req, res) => {
  try {
    // Check if the account is authenticated to perform the operation
    // const accountId = req.params.id;
    // if (req.user.accountId != accountId)
    //   return res
    //     .status(401)
    //     .send({ error: 'You are not authorized to perform this operation' });

    // Return all the followings
    const followingsQuery = await pool.query(
      'SELECT af.followee_id, a.name, a.image_url FROM accounts_followings af JOIN accounts a ON af.followee_id = a.account_id WHERE af.follower_id = $1 ORDER BY af.creation_timestamp DESC',
      [accountId]
    );
    return res.status(200).send(followingsQuery.rows);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Update account details
router.put('/:id/details', authMiddleware, async (req, res) => {
  try {
    // Input validation
    const { error } = validateUpdate(req.body);
    if (error) return res.status(400).send({ error: error.message });

    // Check if the account is authenticated to perform the operation
    const accountId = req.params.id;
    if (req.user.accountId != accountId)
      return res
        .status(401)
        .send({ error: 'You are not authorized to perform this operation' });

    // Update the account details and return the data
    const { name, bio, imageUrl } = req.body;
    const followingsQuery = await pool.query(
      'UPDATE accounts SET name = $1, bio = $2, image_url = $3 WHERE account_id = $4 RETURNING *',
      [name, bio, imageUrl, accountId]
    );
    const extractedResult = followingsQuery.rows[0];

    const sanitizedUser = _.pick(extractedResult, [
      'account_id',
      'public_address',
      'name',
      'bio',
      'image_url',
      'followers',
      'followings',
      'total_views',
      'total_likes',
      'xp',
    ]);
    return res.status(200).send(sanitizedUser);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Joi validations
const validateAccount = (account) => {
  const schema = Joi.object({
    publicAddress: Joi.string().required(),
    name: Joi.string().min(3).max(255).required(),
    bio: Joi.string().max(1024).required(),
    imageUrl: Joi.string().uri().required(),
    nonce: Joi.number().required(),
    signature: Joi.string().required(),
  });

  return schema.validate(account);
};

const validateUpdate = (account) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    bio: Joi.string().max(1024).required(),
    imageUrl: Joi.string().uri().required(),
  });

  return schema.validate(account);
};

module.exports = router;
