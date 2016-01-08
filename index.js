'use strict';

var csv = require('csv');
var bitcore = require('bitcore-lib');
var path = require('path');
var EventEmitter = require('events').EventEmitter;

function Blocksize(options) {
  EventEmitter.call(this);
  this.cache = {};
  this.node = options.node;
}

Blocksize.dependencies = ['bitcoind', 'db', 'web'];

Blocksize.PREFIXES = {
  BLOCKSIZE: new Buffer('10', 'hex')
};

Blocksize.MAX_HEIGHT_BUFFER = new Buffer('ffffffff', 'hex');
Blocksize.MIN_HEIGHT_BUFFER = new Buffer('00000000', 'hex');

Blocksize.prototype.getServiceURL = function() {
  var url = this.node.https ? 'https://' : 'http://';
  url += 'localhost';
  url += (this.node.port === 80) ? '' : ':' + this.node.port + '/';
  url += this.getRoutePrefix() ? this.getRoutePrefix() + '/' : '';
  return url;
};

Blocksize.prototype.start = function(callback) {
  this.node.log.info('Blocksize Service started at:', this.getServiceURL());
  setImmediate(callback);
};

Blocksize.prototype.stop = function(callback) {
  setImmediate(callback);
};

Blocksize.prototype.blockHandler = function(block, add, callback) {
  var sizeBytes = block.toBuffer().length;
  var sizeBytesBuffer = new Buffer(new Array(8));
  sizeBytesBuffer.writeDoubleBE(sizeBytes);

  var hash = block.header.hash;
  var hashBuffer = new Buffer(hash, 'hex');

  var height = block.__height;
  var heightBuffer = new Buffer(new Array(4));
  heightBuffer.writeUInt32BE(height);

  var operations = [];

  var key = Buffer.concat([Blocksize.PREFIXES.BLOCKSIZE, heightBuffer]);
  var value = Buffer.concat([hashBuffer, sizeBytesBuffer]);

  var action = add ? 'put' : 'del';

  operations.push({
    type: action,
    key: key,
    value: value
  });

  setImmediate(function() {
    callback(null, operations);
  });

};

Blocksize.prototype.getAPIMethods = function() {
  return [
    ['exportBlocksizesCSV', this, this.exportBlocksizesCSV, 0]
  ];
};

Blocksize.prototype.exportBlocksizesCSV = function(callback) {
  var self = this;
  var tipHeight = self.node.services.db.tip.__height;
  if (self.cache.height === tipHeight) {
    setImmediate(function() {
      callback(null, self.cache.blocksizes);
    });
  } else {
    self.getBlockSizes(function(err, blocksizes) {
      if (err) {
        return callback(err);
      }
      csv.stringify(blocksizes, function(err, data) {
        if (err) {
          return callback(err);
        }
        self.cache = {
          height: tipHeight,
          blocksizes: data
        };
        callback(null, data);
      });
    });
  }
};

Blocksize.prototype.getBlockSizes = function(callback) {
  var stream = this.node.services.db.store.createReadStream({
    gte: Buffer.concat([Blocksize.PREFIXES.BLOCKSIZE, Blocksize.MIN_HEIGHT_BUFFER]),
    lte: Buffer.concat([Blocksize.PREFIXES.BLOCKSIZE, Blocksize.MAX_HEIGHT_BUFFER]),
    keyEncoding: 'binary',
    valueEncoding: 'binary'
  });

  var blocksizes = [];

  stream.on('data', function(data) {
    var height = data.key.readUInt32BE(1);
    var blocksize = data.value.readDoubleBE(32);
    blocksizes.push([height, blocksize]);
  });

  var error = null;

  stream.on('error', function(err) {
    error = err;
  });

  stream.on('end', function() {
    if (error) {
      return callback(error);
    }
    callback(null, blocksizes);
  });

};

Blocksize.prototype.setupRoutes = function(app, express) {
  var self = this;
  app.set('views', path.resolve(__dirname, './views'));
  app.engine('ejs', require('ejs').__express);
  app.use('/static', express.static(path.resolve(__dirname, './static')));
  app.get('/csv', function(req, res) {
    self.exportBlocksizesCSV(function(err, csv) {
      if (err) {
        return res.status(500).send(err.message);
      }
      res.send(csv);
    });
  });
  app.get('/', function(req, res) {
    res.render('index.ejs', {
      baseUrl: self.getServiceURL()
    });
  });
};

Blocksize.prototype.getRoutePrefix = function() {
  return 'blocksizes';
};

Blocksize.prototype.getPublishEvents = function() {
  return [];
};

module.exports = Blocksize;
