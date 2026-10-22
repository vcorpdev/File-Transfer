# Vcorp File Transfer

The website of [vcorp.app](https://vcorp.app). Send a file that only your recipient can open: it is encrypted in your browser, and destroyed after one download.

## How it works

- The browser creates a 256-bit key (`crypto.getRandomValues`) and encrypts the file with AES-256-GCM before it leaves the device.
- The key is put after the `#` of the link. Browsers never send this part of a URL to a server.
- The server stores the encrypted file under an ID made from the key (its SHA-256). It never sees the key, the file name or the content, and the key cannot be recovered from the ID.
- The file is deleted from the server after its first download, or after 48 hours if nobody opens the link.
- Several files are sent as one zip, built in the browser as a stream.

### Encrypted file format

```
[header: 1024 bytes + 16-byte tag] [part 1] [part 2] ... [last part]
```

- The header holds the file name and type as JSON, padded to 1024 bytes, so the length of the name does not show.
- The file follows in 4 MiB parts, each encrypted on its own and sent in its own request, so a large file is never read whole into memory to be sent.
- The IV of each part is its index (the key is new for every file, so an IV is never used twice), and the last part is flagged in the additional data: parts that are swapped, removed or cut off fail to decrypt.

## Development

```sh
npm install      # install Vite
npm run dev      # local server with live reload
npm run build    # production files in dist/
npm run preview  # serve dist/ locally
```

`npm run build` uses the API address in `.env.production` (`https://vcorp.app:3000`). The other modes use `http://localhost:3000`.

The API is documented at [vcorp.app/docs](https://vcorp.app/docs/).

## Layout

- `index.html`: the page.
- `src/style.css`: all styles.
- `src/main.js`: entry point.
- `src/drop.js`: the drop band: sends a file and shows the link, or receives a file when the page is opened with a link.
- `src/transfer.js`: encryption in the browser, upload in parts, download and decryption.
- `src/zip.js`: several files are sent as one zip, built as a stream.
- `src/planet.js`: geometry of the planet (projection, continents, routes).
- `src/globe.js`: the planet rendered as pixel art on a canvas.
- `src/pixel-art.js`: the other pixel pictures, drawn as SVG.
- `public/`: files copied as is: fonts, logo, images, favicon and `404.html`.

## License

[GNU Affero General Public License v3.0](LICENSE).
