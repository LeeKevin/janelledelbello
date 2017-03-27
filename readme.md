# janelledelbello.com

Build with `npm run build`. Serve contents of `dist` folder.

To run a development server, run `npm run dev` and open your browser to `localhost:8080`.

## Configuration

Set configuration settings in site.js.

* `site`
    * `name` - The name of the site
    * `description` - The description of the site 
* `collections` - An array of category names to organize blog articles

### Index page

The content of the index page will be generated from `src/index.md`. An index of articles will be displayed below
this content.

### Extra files

Files placed in `src/fonts`, `src/images`, or `src/extra` will be copied with their parent directories to directories
 of the same name in `dist/`

### Blog

Articles should be placed in `src/blog`. 

Each article needs frontmatter like:

    ---
    title: "Hello World"
    date: 2016-10-12
    collection: instructional
    new: true
    ---

* `title` is the title of the article.
* `date` is the date that will be published for that article and used for sorting.
* `collection` (optional) is the category to organize the blog. The category must be one of the categories specified 
in the `collections` configuration setting or `portfolio`.
* `new` (optional, default: false) is a boolean flag to designate whether the article is "new".
* `portfolioTitle` (optional) is the title used on the portfolio page (requires `portfolio` category)
* `portfolioDescription` (optional) is the descrption used on the portfolio page (requires `portfolio` category)
* `portfolioImage` (optional) is the background image used on the portfolio page (requires `portfolio` category)
* `portfolioColor` (optional) is the background color (of form "#cccccc") used on the portfolio page if no 
`portfolioImage` 
provided 
(requires `portfolio` category)
