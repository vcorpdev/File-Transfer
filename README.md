# Vcorp File Transfer

The website of [vcorp.app](https://vcorp.app). Send a file that only your recipient can open: it is encrypted in your browser, and destroyed after one download.

## How it works

Your browser generates a 256-bit key, which it then uses to encrypt your file.
It also generates a random 256-bit string, which will be used as the identifier of your file.

If you drop several files, that is not a problem: they will be grouped into a single zip, once again in the browser. Once everything is encrypted, the file is sent to our servers. So they have absolutely no information: they receive an unreadable block of data, which they have to store under an equally unreadable identifier.

Once the server has confirmed it received the file, your browser generates a link containing the identifier of the file and the decryption key. This precious information is not sent in the request, because it sits after the `#` symbol. It is the browser that builds a request from the identifier of the file alone, to retrieve it. The browser then decrypts the file with the key, and the file is immediately destroyed once retrieved.

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
