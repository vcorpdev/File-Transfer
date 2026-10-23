# Vcorp File Transfer

The website of [vcorp.app](https://vcorp.app). Send a file that only your recipient can open: it is encrypted in your browser, and destroyed after one download.

## How it works

### Sending a file

1. **Key generated on your device.** Your browser generates a random 256-bit encryption key. It never leaves your device, except inside the link you share.
2. **ID generated on your device.** Your browser also generates a random identifier for the file, separately from the key. The ID tells nothing about the key.
3. **Encrypted on your device.** The file, its name and its metadata are encrypted with AES-256-GCM, in your browser. Several files are first put together in one zip.
4. **Stored as noise.** Only then is the file sent to our server, under its ID. Our server receives an unreadable block of data, stored under an equally unreadable identifier, always with the same `.bin` extension. It never gets the key, the name or the content.
5. **The link.** The link holds the ID and the key, after the `#` symbol: `https://vcorp.app/#<file ID>.<key>`. When the link is opened, the part after the `#` is not sent with the request for the page: it stays in the browser.

### Receiving a file

1. **Opening the link.** The recipient's browser loads the page, then reads the ID and the key in the link, after the `#`.
2. **Only the ID is sent.** The browser asks our server for the file, with its ID. The key is never sent.
3. **Decrypted on their device.** The file is decrypted in their browser with the key, and saved under its original name.
4. **Gone for good.** The file on our server is destroyed as soon as it has been downloaded once. A file nobody opens is destroyed after 48 hours.

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
