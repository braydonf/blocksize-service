'use strict';

var bitcore = require('bitcore-lib');
var path = require('path');
var EventEmitter = require('events').EventEmitter;

function Blocksize(options) {
  EventEmitter.call(this);

  this.node = options.node;
}

Blocksize.dependencies = ['bitcoind', 'db', 'web'];

Blocksize.PREFIXES = {
  BLOCKSIZE: new Buffer('10', 'hex')
};

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

Blocksize.prototype.setupRoutes = function(app, express) {
  var self = this;
  app.set('views', path.resolve(__dirname, './views'));
  app.engine('ejs', require('ejs').__express);
  app.use('/static', express.static(path.resolve(__dirname, './static')));
  app.get('/', function(req, res) {
    res.render('index.ejs', {
      baseUrl: self.getServiceURL()
    });
  });
};

Blocksize.prototype.getRoutePrefix = function() {
  return 'blocksizes';
};

Blocksize.prototype.getAPIMethods = function() {
  return [];
};

Blocksize.prototype.getPublishEvents = function() {
  return [];
};

module.exports = Blocksize;
