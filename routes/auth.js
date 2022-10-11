const express = require('express');
const router = express.Router();
const { recoverPersonalSignature } = require('eth-sig-util');
const { bufferToHex } = require('ethereumjs-util');
const Joi = require('joi');

// Custom Imports
const pool = require('../db');
const { generateJwtToken } = require('../utils/collection');

// Login
router.post('/', async (req, res) => {
  try {
    // Input validation
    const { error } = validateLogin(req.body);
    if (error) return res.status(400).send({ error: error.message });

    // Check if the user exists in the database if yes -> fetch nonce of the user, else throw error -> account not found
    const { signature, publicAddress } = req.body;
    // console.log(signature, publicAddress);
    const nonceQuery = await pool.query(
      'SELECT account_id, nonce FROM accounts WHERE LOWER(public_address) = LOWER($1)',
      [publicAddress]
    );

    if (nonceQuery.rowCount <= 0)
      return res.status(404).send({ error: 'Account is not registered' });

    // Verify digital signature
    const { account_id, nonce } = nonceQuery.rows[0];
    const msg = `I am signing my one-time nonce: ${nonce}`;
    // console.log(`msg ${msg} \naccount_id ${account_id}`);
    const msgBufferHex = bufferToHex(Buffer.from(msg, 'utf8'));
    // console.log(msgBufferHex);

    const address = recoverPersonalSignature({
      data: msgBufferHex,
      sig: signature,
    });
    // console.log(address);
    if (address.toLowerCase() !== publicAddress.toLowerCase())
      return res
        .status(400)
        .send({ error: 'Digital signature verfication failed' });

    // Generate new nonce and update
    const updatedNonce = Math.floor(Math.random() * 1000000);
    await pool.query('UPDATE accounts SET nonce = $1 WHERE account_id = $2', [
      updatedNonce,
      account_id,
    ]);

    // Generate jwt and return it to the client
    const authToken = generateJwtToken({
      account_id,
      public_address: publicAddress,
    });
    return res.status(200).send(authToken);
  } catch (error) {
    console.log(error);
    return res.status(500).send({ error });
  }
});

// Joi validations
const validateLogin = (data) => {
  const schema = Joi.object({
    publicAddress: Joi.string().required(),
    signature: Joi.string().required(),
  });

  return schema.validate(data);
};

module.exports = router;
