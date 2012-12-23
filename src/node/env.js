var env = exports;

// inherits

env.inherits = require('util').inherits;

// EventEmitter

env.EventEmitter = require('events').EventEmitter;

// Stream.

env.consumeStream = function (stream, next) {
  var buf = [];
  stream.on('data', function (data) {
    buf.push(data);
  });
  stream.on('end', function () {
    next(Buffer.concat(buf));
  });
};

// URL

var url = require('url');

env.url = {
  parse: function (str) {
    var parsed = url.parse(String(str), true);
    return {
      protocol: parsed.protocol || undefined,
      auth: parsed.auth || undefined,
      hostname: parsed.hostname || undefined,
      port: parsed.port || 0,
      pathname: parsed.pathname || undefined,
      query: parsed.query || {},
      search: parsed.search || undefined,
      hash: parsed.hash || undefined
    };
  },

  format: function (str) {
    return url.format(str);
  },

  path: function (obj) {
    return url.parse(url.format(obj), true).path;
  }
};

// Request

var http = require('http');
var https = require('https');
var querystring = require('querystring');

// Some servers actually have an issue with this.
function camelCaseHeaders (lower) {
  var camel = {};
  for (var key in lower) {
    camel[key.replace(/(?:^|\b)\w/g, function (match) {
      return match.toUpperCase();
    })] = lower[key];
  }
  return camel;
}

env.sendRequest = function (opts, agent, next) {
  // Accept HTTP agent. Node.js only.
  if (next == null) {
    next = agent;
    agent = null;
  }

  var req = (opts.url.protocol == 'https:' ? https : http).request({
    agent: agent || undefined,
    method: opts.method,
    headers: camelCaseHeaders(opts.headers),
    protocol: opts.url.protocol,
    hostname: opts.url.hostname,
    port: opts.url.port,
    path: env.url.path(opts.url)
  });

  // Response.
  req.on('response', function (res) {
    // Attempt to follow Location: headers.
    if (((res.statusCode / 100) | 0) == 3 && res.headers['location'] && opts.redirect !== false) {
      env.request.send(env.request.url(opts, res.headers['location']), agent, next);
    } else {
      res.url = env.url.format(opts.url); // Populate res.url property
      next && next(null, res);
    }
  });

  // Headers.
  if (opts.body != null) {
    req.write(opts.body);
  }
  req.end();

  return req;
};

// Query

env.qs = require('querystring');

// Path

env.joinPath = require('path').join;

// XML Parsing

env.parseXML = function (data, next) {
  try {
    var libxmljs = require('libxmljs');
  } catch (e) {
    throw new Error('Please install libxmljs in order to parse XML APIs.')
  }
  next(libxmljs.parseXmlString(data));
};

// Lookup

env.lookupManifestSync = function (name) {
  var fs = require('fs');
  var path = require('path');
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../../services', name + '.json')));
  } catch (e) {
    return null;
  }
};

env.lookupManifest = function (name, next) {
  var fs = require('fs');
  var path = require('path');
  fs.readFile(path.join(__dirname, '../../services', name + '.json'), function (err, data) {
    try {
      next(err, !err && JSON.parse(String(data)));
    } catch (e) {
      next(e);
    }
  });
};

// Configuration/prompt

var persistConfig = true;

var path = require('path');
var clc = require('cli-color');

env.config = require('nconf');
try {
  env.config.file(path.join(require('osenv').home(), '.remconf'));
} catch (e) {
  console.error(clc.yellow('Invalid .remconf settings, overwriting file.'));
}

env.configureManifestOptions = function (api, next) {
  var read = require('read');

  // Optionally prompt for API key/secret.
  if (api.options.key || api.manifest.needsKey === false) {
    return next();
  }

  // Load configuration.
  if (env.config.get(api.manifest.id)) {
    var config = env.config.get(api.manifest.id);
    for (var k in config) {
      api.options[k] = config[k];
    }
    return next();
  }

  // Prompt API keys.
  console.log(clc.yellow('Initializing API keys for ' + api.manifest.id + ' on first use.'));
  if (api.manifest.control) {
    console.log(clc.yellow('Register for an API key here:'), api.manifest.control);
  }
  api.middleware('configure', function () {
    read({
      prompt: clc.yellow(api.manifest.id + ' API key: ')
    }, function (err, key) {
      if (!key) {
        console.error(clc.red('ERROR:'), 'No API key specified, aborting.');
        process.exit(1);
      }

      api.options.key = key;
      read({
        prompt: clc.yellow(api.manifest.id + ' API secret (if provided): ')
      }, function (err, secret) {

        api.options.secret = secret;
        if (persistConfig) {
          env.config.set(api.manifest.id + ':key', key);
          env.config.set(api.manifest.id + ':secret', secret);
          env.config.save(function (err, json) {
            console.log(clc.yellow('Your credentials are saved to the configuration file ' + env.config.stores.file.file));
            console.log(clc.yellow('Edit that file to update or change your credentials.\n'));
            next();
          });
        } else {
          console.log('');
          next();
        }
      });
    });
  });
}

// Array/Buffer detection

env.isList = function (obj) {
  return Array.isArray(obj) || Buffer.isBuffer(obj);
}

// Prompting

env.prompt = function (rem, api) {
  var args = Array.prototype.slice.call(arguments);
  switch (api.manifest.auth && api.manifest.auth.type) {
    case 'oauth':
      return rem.promptOauth.apply(rem, args.slice(1));
    case 'cookies':
      return rem.promptSession.apply(rem, args.slice(1));
    default:
      throw new Error('No support for this authentication type.');
  }
};