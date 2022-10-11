require('dotenv').config();
const config = require('config');
const express = require('express');
const app = express();
const helmet = require('helmet');
const cors = require('cors');
var bodyParser = require('body-parser');

// Route module imports
const videos = require('./routes/videos');
const accounts = require('./routes/accounts');
const listings = require('./routes/listings');
const search = require('./routes/search');
const auth = require('./routes/auth');
const admin = require('./routes/admin');
const wallet = require('./routes/wallet');

// Check if required env variables are set
if (!config.get('jwtPrivateKey') || !config.get('myPublicAddress')) {
  console.error('ERROR: required environmental variable(s) is not set');
  process.exit(1);
}

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '400mb' }));

// Route handlers
app.use('/api/videos', videos);
app.use('/api/accounts', accounts);
app.use('/api/listings', listings);
app.use('/api/search', search);
app.use('/api/auth', auth);
app.use('/api/admin', admin);
app.use('/api/wallet', wallet);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running in PORT ${PORT}`);
});
