var gulp = require('gulp');
var inject = require('gulp-inject');
var sass = require('gulp-sass');
var cleanCSS = require('gulp-clean-css');
var sourcemaps = require('gulp-sourcemaps');
var autoprefixer = require('gulp-autoprefixer');
var rev = require('gulp-rev');
var globby = require('globby');
var rimraf = require('rimraf');

var gulpsmith = require('gulpsmith');
var metalsmith = require('metalsmith');
var collections = require('metalsmith-collections');
var markdown = require('metalsmith-markdown');
var permalinks = require('metalsmith-permalinks');
var template = require('./src/plugins/template');
var handlebars = require('handlebars');
var intercept = require('gulp-intercept');
var frontmatter = require('gulp-front-matter');
var es = require('event-stream');

var config = require('./site');

// Build collections
var collectionTypes = config.collections ? config.collections.reduce(function (types, c) {
        var coll = {};
        coll[c] = {
            sortBy: 'date',
            reverse: true,
        };
        if (c !== 'portfolio') {
            coll[c].limit = 5;
        }

        return Object.assign(
            types,
            coll
        )
    }, {}) : [];
delete config.collections;

function copyMisc() {
    copy('./node_modules/font-awesome/fonts/**/*', './dist/fonts');
    copy('./src/fonts/**/*', './dist/fonts');
    copy('./CNAME', './dist');
}

gulp.task('watch', ['build', 'extra', 'images'], function () {
    gulp.watch('./src/**/*', ['run']);
    gulp.watch('./src/images/**/*', ['images']);
    gulp.watch('./src/extra/**/*', ['extra']);
});

gulp.task('build', ['run', 'extra', 'images'], function () {
    copyMisc();
});

gulp.task('images', function () {
    return copy('./src/images/**/*', './dist/images');
});

gulp.task('extra', function () {
    return copy('./src/extra/**/*', './dist/extra');
});


var indexTemplate, portfolioTemplate, blogTemplate, articleTemplate;
gulp.task('templates', function () {
    var cssStream = gulp
        .src('./src/styles/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({ includePaths: ['node_modules', '.'] }).on('error', sass.logError))
        .pipe(autoprefixer())
        .pipe(cleanCSS())
        .pipe(sourcemaps.write())
        .pipe(rev())
        .pipe(gulp.dest('./dist'));

    return es.concat(
        gulp
            .src('./src/layouts/index.html')
            .pipe(inject(cssStream, { ignorePath: 'dist/', addRootSlash: false }))
            .pipe(intercept(function (file) {
                indexTemplate = file.contents.toString();

                return file;
            })),
        gulp
            .src('./src/layouts/portfolio.html')
            .pipe(inject(cssStream, { ignorePath: 'dist/', addRootSlash: true }))
            .pipe(intercept(function (file) {
                portfolioTemplate = file.contents.toString();

                return file;
            })),
        gulp
            .src('./src/layouts/blog.html')
            .pipe(inject(cssStream, { ignorePath: 'dist/', addRootSlash: true }))
            .pipe(intercept(function (file) {
                blogTemplate = file.contents.toString();

                return file;
            })),
        gulp
            .src('./src/layouts/article.html')
            .pipe(inject(cssStream, { ignorePath: 'dist/', addRootSlash: true }))
            .pipe(intercept(function (file) {
                articleTemplate = file.contents.toString();

                return file;
            }))
    );
});


var metadata;
gulp.task('articles', ['templates'], function () {
    return gulp
        .src('./src/blog/**/*.md')
        .pipe(frontmatter())
        .on("data", function (file) {
            Object.assign(file, file.frontMatter);
            delete file.frontMatter;
        })
        .pipe(
            gulpsmith()
                .metadata(config)
                .use(markdown())
                .use(function (files, metalsmith, done) {
                    Object.keys(files).forEach(function (key) {
                        if (!files.hasOwnProperty(key)) {
                            return
                        }

                        var file = files[key];
                        file.plainContents = file.contents;
                        file.paginate = 'articles';
                        file.isPortfolio = file.collection == 'portfolio';
                    });
                    done();
                })
                .use(collections(Object.assign(
                    {
                        articles: {
                            pattern: '**/*.html',
                            sortBy: 'date',
                            reverse: true,
                        },
                        latest: {
                            pattern: '**/*.html',
                            sortBy: 'date',
                            reverse: true,
                            limit: 10
                        },
                        portfolio: {
                            sortBy: 'date',
                            reverse: true
                        }
                    },
                    collectionTypes
                )))
                .use(permalinks({
                    relative: false,
                    pattern: ':title'
                }))
                .use(function (files, metalsmith, done) {
                    metadata = metalsmith.metadata();
                    done();
                })
                .use(template({
                    directory: './src/layouts',
                    pattern: ["*/*/*html", "*/*html", "*html"],
                    template: articleTemplate,
                    partials: {
                        bar: 'partials/blog-bar'
                    }
                }))
        )
        .pipe(gulp.dest('./dist/blog'));
});

gulp.task('pages', ['articles'], function () {
    return es.concat(
        gulp
            .src('./src/pages/portfolio.md')
            .pipe(
                gulpsmith()
                    .metadata(metadata)
                    .use(markdown())
                    .use(permalinks({
                        relative: false,
                        pattern: ':title'
                    }))
                    .use(template({
                        directory: './src/layouts',
                        pattern: ["*/*/*html", "*/*html", "*html"],
                        template: portfolioTemplate,
                        partials: {
                            header: 'partials/header'
                        }
                    }))
            )
            .pipe(gulp.dest('./dist')),
        gulp
            .src('./src/pages/blog.md')
            .pipe(
                gulpsmith()
                    .metadata(metadata)
                    .use(markdown())
                    .use(permalinks({
                        relative: false,
                        pattern: ':title'
                    }))
                    .use(function (files, metalsmith, done) {
                        var blogIndex = files['blog/index.html'];
                        var metadata = metalsmith.metadata();
                        var articles = metadata.articles.slice(0);
                        var paginateLimit = 10;

                        blogIndex.pagination = {
                            limit: paginateLimit,
                            start: 0,
                            prev: null,
                            next: null,
                        };

                        var chain = [blogIndex];
                        var position = 1;
                        while (articles.slice(position * paginateLimit, position * (paginateLimit + 1)).length) {
                            var prev = chain[position - 1];
                            var next = Object.assign({}, blogIndex);
                            next.pagination = Object.assign({}, next.pagination);

                            next.pagination.start = position * paginateLimit;
                            next.pagination.prev = prev;
                            next.path = 'blog/page/' + (position + 1);
                            next.page = position + 1;
                            files[next.path + '/index.html'] = next;
                            prev.pagination.next = next;

                            chain.push(next);
                            position++;
                        }

                        done();
                    })
                    .use(template({
                        directory: './src/layouts',
                        pattern: ["*/*/*/*html", "*/*/*html", "*/*html", "*html"],
                        template: blogTemplate,
                        partials: {
                            bar: 'partials/blog-bar'
                        }
                    }))
            )
            .pipe(gulp.dest('./dist')),
        gulp
            .src('./src/pages/index.md')
            .pipe(frontmatter())
            .on("data", function (file) {
                Object.assign(file, file.frontMatter);
                delete file.frontMatter;
            })
            .pipe(
                gulpsmith()
                    .metadata(metadata)
                    .use(markdown())
                    .use(permalinks({
                        relative: false,
                        pattern: ':title'
                    }))
                    .use(template({
                        directory: './src/layouts',
                        pattern: ["*/*/*html", "*/*html", "*html"],
                        template: indexTemplate,
                        partials: {
                            header: 'partials/header'
                        }
                    }))
            )
            .pipe(gulp.dest('./dist'))
    )
});

gulp.task('run', ['clean', 'pages'], function () {
    return null
});

gulp.task('clean', function() {
    globby(['dist/*', '!dist/.git'])
        .then(function then(paths) {
            paths.map(function map(item) {
                rimraf.sync(item);
            });
        });
});

function copy(origin, dest) {
    return gulp
        .src(origin)
        .pipe(gulp.dest(dest));
}
