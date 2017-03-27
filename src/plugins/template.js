/**
 * Dependencies
 */
var each = require('async').each;
var extend = require('extend');
var omit = require('lodash.omit');
var path = require('path');
var renderer = require('./helpers/renderer');

/**
 * Helpers
 */
var check = require('./helpers/check');
var readPartials = require('./helpers/read-partials');

/**
 * Expose `plugin`.
 */
module.exports = plugin;

/**
 * Settings
 *
 * Options supported by metalsmith-layouts
 */
var settings = [
    'default',
    'template',
    'directory',
    'partials',
    'partialExtension',
    'pattern',
    'rename'
];

/**
 * Metalsmith plugin to run files through any layout in a layout `dir`.
 *
 * @param {String or Object} options
 *   @property {String} template (optional)
 *   @property {String} default (optional)
 *   @property {String} directory (optional)
 *   @property {String} partials (optional)
 *   @property {String} partialExtension (optional)
 *   @property {String} pattern (optional)
 *   @property {Boolean} rename (optional)
 * @return {Function}
 */
function plugin(opts) {
    /**
     * Init
     */
    opts = opts || {};

    // Map options to local variables
    var def = opts.default;
    var dir = opts.directory || 'layouts';
    var partialExtension = opts.partialExtension;
    var partials = opts.partials;
    var pattern = opts.pattern;
    var rename = opts.rename;
    var template = opts.template;


    // Move all unrecognised options to params
    var params = omit(opts, settings);

    /**
     * Main plugin function
     */
    return function (files, metalsmith, done) {
        var metadata = metalsmith.metadata();
        var matches = {};

        /**
         * Process any partials and pass them to consolidate as a partials object
         */
        if (partials) {
            if (typeof partials === 'string') {
                params.partials = readPartials(partials, partialExtension, dir, metalsmith);
            } else {
                params.partials = partials;
            }
        }

        /**
         * Stringify files that pass the check, pass to matches
         */
        Object.keys(files).forEach(function (file) {
            if (!check(files, file, pattern)) {
                return;
            }

            var data = files[file];
            data.contents = data.contents.toString();
            matches[file] = data;
        });

        /**
         * Render files
         */
        function convert(file, done) {
            var data = files[file];

            // Deep clone params (by passing 'true')
            var clonedParams = extend(true, {}, params);
            var clone = extend({}, clonedParams, metadata, data);
            var str, render;
            if (template) {
                str = template;
                render = renderer.fromStr(dir);
            } else {
                str = metalsmith.path(dir, data.layout || def);
                render = renderer.fromPath;
            }


            // Rename file if necessary
            var fileInfo;
            if (rename) {
                delete files[file];
                fileInfo = path.parse(file);
                file = path.join(fileInfo.dir, fileInfo.name + '.html');
            }

            render(str, clone, function (err, str) {
                if (err) {
                    return done(err);
                }

                data.contents = new Buffer(str);

                files[file] = data;
                done();
            });
        }

        /**
         * Render all matched files
         */
        each(Object.keys(matches), convert, done);
    };
}
