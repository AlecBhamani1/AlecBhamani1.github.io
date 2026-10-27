# Alec Bhamani — Portfolio

The source for [alecbhamani.com](https://alecbhamani.com), a static portfolio focused on data science, machine learning, and analytics work.

## Local preview

Serve the repository root with any static server. For example:

```sh
python3 -m http.server 4173
```

The readable stylesheet is `assets/styles.css`; the page serves `assets/styles.min.css`. After changing the readable source, regenerate the production file with:

```sh
npx clean-css-cli -o assets/styles.min.css assets/styles.css
```

## Globe background

The original geographic globe is restored in `assets/globe.js`, with a neutral
slate and silver palette. It uses real coastlines, city coordinates, and animated
connections. The animation pauses in background tabs and renders a static globe
when the visitor enables reduced motion.

All globe dependencies are served locally in `assets/globe/` so the page does not
need a third-party CDN at runtime:

- D3 7.9.0 (ISC; `LICENSE-d3`)
- topojson-client 3.1.0 (ISC; `LICENSE-topojson-client`)
- world-atlas 2.0.2, Natural Earth 110m countries (ISC; `LICENSE-world-atlas`;
  underlying Natural Earth geography is public domain)

Project summaries link to their repositories. Each project's native
“Technical details” disclosure contains its contribution notes and evidence.

## Updating the résumé

Replace `assets/alec-bhamani-resume.pdf` to update every résumé link. Keep the
filename stable, and update the experience dates and summary in `index.html` when
the résumé changes.
