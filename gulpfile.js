var gulp = require('gulp');
var inject = require('gulp-inject');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var autoprefixer = require('gulp-autoprefixer');

gulp.task('watch', ['build'], function () {
    gulp.watch('./src/**/*', ['build']);
});

gulp.task('build', function () {
    var stream = gulp.src('./src/styles/**/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({includePaths: ['node_modules', '.']}).on('error', sass.logError))
        .pipe(autoprefixer())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist'));

    gulp.src('./src/pages/index.html')
        .pipe(inject(stream, {ignorePath: 'dist/', addRootSlash: false}))
        .pipe(gulp.dest('./dist'));

    return stream
});

copy('./node_modules/font-awesome/fonts/**/*', './dist/fonts');
copy('./src/fonts/**/*', './dist/fonts');
copy('./src/images/**/*', './dist/images');

function copy(origin, dest) {
    return gulp.src(origin)
        .pipe(gulp.dest(dest));
}