// Generated by CoffeeScript 1.3.1
(function() {
  var docs, fs, keys, read, rem;

  rem = require('../rem');

  fs = require('fs');

  read = require('read');

  keys = JSON.parse(fs.readFileSync(__dirname + '/keys.json'));

  docs = rem.load('google-docs', '3', {
    key: keys.google.key,
    secret: keys.google.secret,
    format: 'xml'
  });

  rem.oauthConsole(docs, function(err, user) {
    return user('default/private/full').get(function(err, xml) {
      var title, _i, _len, _ref, _results;
      if (err) {
        console.log(err);
        return;
      }
      _ref = xml.find('/a:feed/a:entry/a:title', {
        a: "http://www.w3.org/2005/Atom"
      });
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        title = _ref[_i];
        _results.push(console.log('Document:', title.text()));
      }
      return _results;
    });
  });

}).call(this);
