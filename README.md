# Zidni

A small reading app for discovering random Wikipedia articles.

## Run locally

Requires Node.js 20 or later. There are no dependencies to install.

```sh
npm start
```

Open http://localhost:4173. To use a different port, set `PORT` before starting the server.

```sh
npm run check
```

Click **A random page** to read an English Wikipedia excerpt. The source link opens the full article. An internet connection is needed to load articles.

Use **Keep** to save a page in your notebook. The three most recent pages appear beside the article. Bookmarks and history stay in this browser; clearing browser data removes them. The notebook holds up to 500 pages and history keeps the latest 60.

Search the notebook by title or excerpt. **Export notebook** downloads all saved pages, including their source links, as a text file.

Use **A− / A+** to choose a text size between 16 and 24 pixels. The size is remembered. **Quiet reading** hides the surrounding controls; press Escape to leave it. Space opens another random page when you are not using an input or button.

The daily counter marks three different discoveries each day, using your local date. Opening a page from history does not increase it. You can keep reading after three pages.

Some excerpts include a Wikipedia thumbnail. Follow its image details link to check the author and license. Text excerpts link to their original article and are shared under CC BY-SA 4.0.
Interface text is kept in locales.js. The app opens in English by default.

Choose English, French, Arabic, or Moroccan Darija in the language menu. The choice changes the interface and the language of the next Wikipedia article. Articles already open keep their original language. The menu supports arrow keys, Home, End, Escape, and Tab.

The landing page includes a description, social metadata, structured app information, and readable help content before JavaScript runs. Random excerpts are excluded from search snippets. A production canonical URL and sitemap are added only when a public domain is configured.

## Public hosting

When a production domain is ready, run:

```sh
npm run prepare:seo -- https://your-domain.tld
```

This updates index.html and robots.txt and creates sitemap.xml. Run it again to change domains. Deploy the generated files with the site. The server stays on the local loopback address; use static hosting or configure your hosting service separately. Search visibility depends on publication and indexing, and no ranking is guaranteed.

The social preview is social-card.png (1200 × 630). Its editable source is social-card.svg.
