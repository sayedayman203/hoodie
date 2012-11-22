// Generated by CoffeeScript 1.3.3
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __slice = [].slice;

Hoodie.Remote = (function() {

  Remote.prototype.name = void 0;

  Remote.prototype._sync = false;

  Remote.prototype.prefix = '';

  function Remote(hoodie, options) {
    this.hoodie = hoodie;
    if (options == null) {
      options = {};
    }
    this._handlePushSuccess = __bind(this._handlePushSuccess, this);

    this._handlePullResults = __bind(this._handlePullResults, this);

    this._handlePullError = __bind(this._handlePullError, this);

    this._handlePullSuccess = __bind(this._handlePullSuccess, this);

    this._restartPullRequest = __bind(this._restartPullRequest, this);

    this.sync = __bind(this.sync, this);

    this.push = __bind(this.push, this);

    this.pull = __bind(this.pull, this);

    this.stopSyncing = __bind(this.stopSyncing, this);

    this.startSyncing = __bind(this.startSyncing, this);

    this.disconnect = __bind(this.disconnect, this);

    this.connect = __bind(this.connect, this);

    if (options.name != null) {
      this.name = options.name;
      this.prefix = this.name;
    }
    if (options.prefix != null) {
      this.prefix = options.prefix;
    }
    if (options.sync) {
      this._sync = options.sync;
    }
    this.store = new Hoodie.RemoteStore(this.hoodie, this);
    if (this.isContinuouslySyncing()) {
      this.startSyncing();
    }
  }

  Remote.prototype.request = function(type, path, options) {
    if (options == null) {
      options = {};
    }
    if (this.name) {
      path = "/" + (encodeURIComponent(this.name)) + path;
    }
    options.contentType || (options.contentType = 'application/json');
    if (type === 'POST' || type === 'PUT') {
      options.dataType || (options.dataType = 'json');
      options.processData || (options.processData = false);
      options.data = JSON.stringify(options.data);
    }
    return this.hoodie.request(type, path, options);
  };

  Remote.prototype.get = function(view_name, params) {
    return console.log.apply(console, [".get() not yet implemented"].concat(__slice.call(arguments)));
  };

  Remote.prototype.post = function(update_function_name, params) {
    return console.log.apply(console, [".post() not yet implemented"].concat(__slice.call(arguments)));
  };

  Remote.prototype.connect = function(options) {
    this.connected = true;
    return this.sync();
  };

  Remote.prototype.disconnect = function() {
    var _ref, _ref1;
    this.connected = false;
    if ((_ref = this._pullRequest) != null) {
      _ref.abort();
    }
    return (_ref1 = this._pushRequest) != null ? _ref1.abort() : void 0;
  };

  Remote.prototype.startSyncing = function() {
    this._sync = true;
    return this.connect();
  };

  Remote.prototype.stopSyncing = function() {
    return this._sync = false;
  };

  Remote.prototype.isContinuouslyPulling = function() {
    var _ref;
    return this._sync === true || ((_ref = this._sync) != null ? _ref.pull : void 0) === true;
  };

  Remote.prototype.isContinuouslyPushing = function() {
    var _ref;
    return this._sync === true || ((_ref = this._sync) != null ? _ref.push : void 0) === true;
  };

  Remote.prototype.isContinuouslySyncing = function() {
    return this._sync === true;
  };

  Remote.prototype.getSinceNr = function() {
    return this._since || 0;
  };

  Remote.prototype.setSinceNr = function(seq) {
    return this._since = seq;
  };

  Remote.prototype.pull = function() {
    this._pullRequest = this.request('GET', this._pullUrl());
    if (this.connected && this.isContinuouslyPulling()) {
      window.clearTimeout(this._pullRequestTimeout);
      this._pullRequestTimeout = window.setTimeout(this._restartPullRequest, 25000);
    }
    return this._pullRequest.then(this._handlePullSuccess, this._handlePullError);
  };

  Remote.prototype.push = function(docs) {
    var doc, docsForRemote, _i, _len;
    if (!(docs != null ? docs.length : void 0)) {
      return this.hoodie.defer().resolve([]).promise();
    }
    docsForRemote = [];
    for (_i = 0, _len = docs.length; _i < _len; _i++) {
      doc = docs[_i];
      docsForRemote.push(this.store.parseForRemote(doc));
    }
    this._pushRequest = this.request('POST', "/_bulk_docs", {
      data: {
        docs: docsForRemote,
        new_edits: false
      }
    });
    return this._pushRequest.done(this._handlePushSuccess(docs, docsForRemote));
  };

  Remote.prototype.sync = function(docs) {
    return this.push(docs).pipe(this.pull);
  };

  Remote.prototype.on = function(event, cb) {
    event = event.replace(/(^| )([^ ]+)/g, "$1" + this.name + ":$2");
    return this.hoodie.on(event, cb);
  };

  Remote.prototype.one = function(event, cb) {
    event = event.replace(/(^| )([^ ]+)/g, "$1" + this.name + ":$2");
    return this.hoodie.one(event, cb);
  };

  Remote.prototype.trigger = function() {
    var event, parameters, _ref;
    event = arguments[0], parameters = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    return (_ref = this.hoodie).trigger.apply(_ref, ["" + this.name + ":" + event].concat(__slice.call(parameters)));
  };

  Remote.prototype._pullUrl = function() {
    var since;
    since = this.getSinceNr();
    if (this.isContinuouslyPulling()) {
      return "/_changes?include_docs=true&since=" + since + "&heartbeat=10000&feed=longpoll";
    } else {
      return "/_changes?include_docs=true&since=" + since;
    }
  };

  Remote.prototype._restartPullRequest = function() {
    var _ref;
    return (_ref = this._pullRequest) != null ? _ref.abort() : void 0;
  };

  Remote.prototype._handlePullSuccess = function(response) {
    this.setSinceNr(response.last_seq);
    this._handlePullResults(response.results);
    if (this.connected && this.isContinuouslyPulling()) {
      return this.pull();
    }
  };

  Remote.prototype._handlePullError = function(xhr, error, resp) {
    if (!this.connected) {
      return;
    }
    switch (xhr.status) {
      case 401:
        this.trigger('error:unauthenticated', error);
        return this.disconnect();
      case 404:
        return window.setTimeout(this.pull, 3000);
      case 500:
        this.trigger('error:server', error);
        return window.setTimeout(this.pull, 3000);
      default:
        if (!this.isContinuouslyPulling()) {
          return;
        }
        if (xhr.statusText === 'abort') {
          return this.pull();
        } else {
          return window.setTimeout(this.pull, 3000);
        }
    }
  };

  Remote.prototype._knownObjects = {};

  Remote.prototype._handlePullResults = function(changes) {
    var doc, event, parsedDoc, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = changes.length; _i < _len; _i++) {
      doc = changes[_i].doc;
      parsedDoc = this.store.parseFromRemote(doc);
      if (parsedDoc._deleted) {
        event = 'remove';
        delete this._knownObjects[doc._id];
      } else {
        if (this._knownObjects[doc._id]) {
          event = 'update';
        } else {
          event = 'add';
          this._knownObjects[doc._id] = 1;
        }
      }
      this.trigger("store:" + event, parsedDoc);
      this.trigger("store:" + event + ":" + parsedDoc.$type, parsedDoc);
      this.trigger("store:" + event + ":" + parsedDoc.$type + ":" + parsedDoc.id, parsedDoc);
      this.trigger("store:change", event, parsedDoc);
      this.trigger("store:change:" + parsedDoc.$type, event, parsedDoc);
      _results.push(this.trigger("store:change:" + parsedDoc.$type + ":" + parsedDoc.id, event, parsedDoc));
    }
    return _results;
  };

  Remote.prototype._handlePushSuccess = function(docs, pushedDocs) {};

  return Remote;

})();
