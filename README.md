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
