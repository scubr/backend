const config = require('config');
const jwt = require('jsonwebtoken');

const generateJwtToken = (account) => {
  return jwt.sign(
    {
      accountId: account.account_id,
      publicAddress: account.public_address,
    },
    config.get('jwtPrivateKey')
  );
};

module.exports = { generateJwtToken };
