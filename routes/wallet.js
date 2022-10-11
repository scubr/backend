const express = require('express');
const router = express.Router();
const Joi = require('joi');

// Custom Imports
const pool = require('../db');

// Middlewares
const authMiddleware = require('../middlewares/auth');

// get balance and internal wallet address
router.get('/details', authMiddleware, async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const searchQuery = await pool.query(
      `SELECT
        internal_wallet_address, balance
      FROM accounts_wallet
      WHERE account_id = $1`,
      [accountId]
    );
    const walletDetails = searchQuery.rows[0];
    return res.status(200).send(walletDetails);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Send tokens to another account using internal wallet address
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { destinationWalletAddress, amount } = req.body;
    const accountId = req.user.accountId;

    const currentBalance = await pool.query(
      `SELECT
        balance
      FROM accounts_wallet
      WHERE account_id = $1`,
      [accountId]
    );

    if (currentBalance.rows[0].balance < amount)
      return res
        .status(400)
        .send({ error: 'Balance not enough to send the funds' });

    await pool.query(
      'UPDATE accounts_wallet SET balance = balance - $1 WHERE account_id = $2 RETURNING *',
      [amount, accountId]
    );

    await pool.query(
      'UPDATE accounts_wallet SET balance = balance + $1 WHERE internal_wallet_address = $2 RETURNING *',
      [amount, destinationWalletAddress]
    );

    return res.status(200).send({
      balance: currentBalance.rows[0].balance - amount,
    });
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Withdraw token from wallet
router.post('/withdraw', authMiddleware, async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const { amount } = req.body;

    await pool.query(
      'UPDATE accounts_wallet SET balance = balance - $1 WHERE account_id = $2 RETURNING *',
      [amount, accountId]
    );

    return res.status(200).send('Success, money has been withdrawn');
  } catch (error) {
    return res.status(500).send({ error });
  }
});

//
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const accountId = req.user.accountId;

    const historyQuery = await pool.query(
      `SELECT *
      FROM accounts_pastmetrics
      WHERE account_id = $1
      ORDER BY metrics_date DESC`,
      [accountId]
    );
    const historyResults = historyQuery.rows;
    return res.status(200).send(historyResults);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Create a new staking
router.post('/staking', authMiddleware, async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const { amount, duration } = req.body;

    const insertQuery = await pool.query(
      `INSERT INTO accounts_staking(account_id, amount, duration) VALUES($1, $2, $3) RETURNING *`,
      [accountId, amount, duration]
    );

    const newStaking = insertQuery.rows[0];
    return res.status(201).send(newStaking);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Withdraw a staking
router.put('/staking', authMiddleware, async (req, res) => {
  try {
    const { stakingId } = req.body;

    await pool.query(
      `UPDATE accounts_staking SET is_withdrawn = true WHERE staking_id = $1 RETURNING *`,
      [stakingId]
    );

    return res.status(200).send('Success, Staking Withdrawn');
  } catch (error) {
    return res.status(500).send({ error });
  }
});

// Get staking details
router.get('/staking', authMiddleware, async (req, res) => {
  try {
    const accountId = req.user.accountId;

    const stakingQuery = await pool.query(
      `SELECT * FROM accounts_staking WHERE account_id = $1`,
      [accountId]
    );

    const stakingDetails = stakingQuery.rows;
    return res.status(201).send(stakingDetails);
  } catch (error) {
    return res.status(500).send({ error });
  }
});

module.exports = router;
