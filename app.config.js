const { version } = require('./package.json');
const { expo } = require('./app.json');

module.exports = {
  ...expo,
  version,
};
