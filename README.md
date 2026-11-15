# Zidni

## Interface

An editorial reading interface for discovering Wikipedia, with light and dark themes and layouts adapted to desktop, tablet and mobile.

- Ivory/blue reading interface and a charcoal dark theme, with locally remembered preference.
- Wide article layout on desktop and stacked reading cards on tablets and mobile.
- Comfortable touch targets, readable mobile inputs and a pinned discovery toolbar on phones.
- Topic shortcuts, all 30 topic options, and language selection in the header.
- Original discovery, notebook, export, four languages and RTL behavior preserved.
- Locally served Newsreader, Geist and Cairo fonts, with licenses in `assets/fonts/`.

Run `npm start`, then open **http://localhost:4173**. No installation or build is required. The server binds to `127.0.0.1` only. Article discovery still needs an Internet connection to Wikipedia.

Edit `redesign.css` for the new visual system; it is loaded after the original `styles.css`. `node prepare-fonts.mjs` refreshes the bundled fonts when needed. `npm test` runs the existing functional tests and `npm run check` checks JavaScript syntax.

The redesign was verified in a browser across 72 combinations of language, theme and viewport width (320–1440 px), including text contrast, language menus, the mobile notebook and emulated touch gestures. Machine-specific verification scripts, reports and screenshots in `.design/` are kept out of Git.

## Application

Random Wikipedia articles in English, French, Arabic, and Moroccan Darija. Save what you like in a browser notebook.

Choose from 30 topics, or keep all topics for an unrestricted random discovery. Your choice is remembered in this browser. Topic discoveries follow Wikipedia categories and their subcategories in the selected language; availability depends on that edition of Wikipedia.

Topic discoveries mix articles from several category branches when available. The last 1,000 article IDs are remembered in this browser to avoid recent repeats, including between visits. If a search finds only recently seen pages, try again or choose another topic or language.

Discover one article card at a time. Swipe upward on its image, press the up arrow while the card is focused, or use the next button to discover another page. The text area scrolls normally on touchscreens. Save a card to your notebook or choose Read more to open the full article on Wikipedia.

Use the sun/moon button in the header to switch between light and dark mode. Zidni follows your device's color scheme until you choose a mode, then remembers your choice in this browser.

[Open Zidni](https://benziza.github.io/zidni/)

To run locally with Node.js 20 or later:

```sh
npm start
```

Open http://localhost:4173. No dependencies needed.

Article text comes from Wikipedia under CC BY-SA 4.0. Image credits are linked from each article.
