# Vcorp File Transfer

The website of [vcorp.app](https://vcorp.app). Send a file that only your recipient can open: it is encrypted in your browser, and destroyed after one download.

## How it works

### Sending a file

1. **A key is generated.** Your browser creates a random 256-bit key (`crypto.getRandomValues`). It never leaves your device, except inside the link you share.
2. **A file ID is generated.** The browser also creates a random 256-bit file ID, separately from the key: one tells nothing about the other. The server will store the file under this ID.
3. **The file is encrypted.** The browser encrypts the file name and type, then the file itself, with AES-256-GCM. Several files are first put into one zip, built in the browser.
4. **The encrypted file is sent.** It goes to the server in parts, under its ID. The server only receives unreadable bytes: no name, no content, no key.
5. **The link is built.** It holds the file ID and the key after the `#`: `https://vcorp.app/#<file ID>.<key>`. Browsers never send this part of a URL to a server.

### Receiving a file

1. **The recipient opens the link.** Their browser reads the file ID and the key after the `#`.
2. **The encrypted file is downloaded** with this ID.
3. **The file is decrypted** in their browser, and saved under its original name.
4. **The file is destroyed.** The server deletes it as soon as it has been downloaded once. A file nobody opens is deleted after 48 hours.

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
