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

