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
