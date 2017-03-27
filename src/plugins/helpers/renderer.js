var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');
var handlebars = require('handlebars');
var moment = require('moment');
var truncate = require('truncate-html');

var join = path.join;
var dirname = path.dirname;

var readCache = {};

/**
 * Require cache.
 */

var cacheStore = {};


/**
 * Clear the cache.
 *
 * @api public
 */

exports.clearCache = function () {
    cacheStore = {};
};

/**
 * Conditionally cache `compiled` template based
 * on the `options` filename and `.cache` boolean.
 *
 * @param {Object} options
 * @param {Function} compiled
 * @return {Function}
 * @api private
 */

function cache(options, compiled) {
    // cachable
    if (compiled && options.filename && options.cache) {
        delete readCache[options.filename];
        cacheStore[options.filename] = compiled;
        return compiled;
    }

    // check cache
    if (options.filename && options.cache) {
        return cacheStore[options.filename];
    }

    return compiled;
}

/**
 * Read `path` with `options` with
 * callback `(err, str)`. When `options.cache`
 * is true the template string will be cached.
 *
 * @param {String} options
 * @param {Function} fn
 * @api private
 */

function read(path, options, fn) {
    var str = readCache[path];
    var cached = options.cache && str && typeof str === 'string';

    // cached (only if cached is a string and not a compiled template function)
    if (cached) return fn(null, str);

    // read
    fs.readFile(path, 'utf8', function (err, str) {
        if (err) return fn(err);
        // remove extraneous utf8 BOM marker
        str = str.replace(/^\uFEFF/, '');
        if (options.cache) readCache[path] = str;
        fn(null, str);
    });
}

/**
 * Read `path` with `options` with
 * callback `(err, str)`. When `options.cache`
 * is true the partial string will be cached.
 *
 * @param {String} options
 * @param {Function} fn
 * @api private
 */

function readPartials(path, options, fn) {
    if (!options.partials) return fn();
    var partials = options.partials;
    var keys = Object.keys(partials);

    function next(index) {
        if (index === keys.length) return fn(null);
        var key = keys[index];
        var file = join(dirname(path), partials[key] + '.html');
        read(file, options, function (err, str) {
            if (err) return fn(err);
            options.partials[key] = str;
            next(++index);
        });
    }

    next(0);
}


/**
 * promisify
 */
function promisify(fn, exec) {
    return new Promise(function (res, rej) {
        fn = fn || function (err, html) {
                if (err) {
                    return rej(err);
                }
                res(html);
            };
        exec(fn);
    });
}


function render(str, options, fn) {
    return promisify(fn, function (fn) {
        try {
            for (var partial in options.partials) {
                handlebars.registerPartial(partial, options.partials[partial]);
            }
            for (var helper in options.helpers) {
                handlebars.registerHelper(helper, options.helpers[helper]);
            }
            var tmpl = cache(options) || cache(options, handlebars.compile(str, options));
            fn(null, tmpl(options));
        } catch (err) {
            fn(err);
        }
    });
}

function renderFromString(path) {
    return function (str, options, fn) {
        return promisify(fn, function (fn) {
            readPartials(path, options, function (err) {
                if (err) return fn(err);
                if (cache(options)) {
                    render('', options, fn);
                } else {
                    render(str, options, fn);
                }
            });
        });
    }
}


function renderFromPath(path, options, fn) {
    options.filename = path;

    return promisify(fn, function (fn) {
        readPartials(path, options, function (err) {
            if (err) return fn(err);
            if (cache(options)) {
                render('', options, fn);
            } else {
                read(path, options, function (err, str) {
                    if (err) return fn(err);
                    render(str, options, fn);
                });
            }
        });
    });
}

// default helpers
handlebars.registerHelper('parseDate', function (date) {
    return moment(date).utc().format('MMMM D, YYYY')
});

handlebars.registerHelper('htmlBlurb', function (html, wordLength) {
    if (html instanceof Uint8Array) {
        html = String.fromCharCode.apply(null, html)
    }

    return truncate(html, wordLength, { byWords: true, keepWhitespaces: true });
});

handlebars.registerHelper('limit', function (collection, limit, start) {
    return collection.slice(start, start + limit);
});


module.exports = {
    fromPath: renderFromPath,
    fromStr: renderFromString
};
