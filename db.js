const Pool = require('pg').Pool;

const pool = new Pool({
  user: 'aowieskfgocajb',
  password: '12b88788bce2703eba0e4d2308f2feec501193345314f27014829ee37234cab7',
  host: 'ec2-3-89-214-80.compute-1.amazonaws.com',
  port: 5432,
  database: 'd9lq50g785gvvi',
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;

// Local postgres password: NaveenKumar#122
// Cloud postgres password:
