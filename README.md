**If not obvious, I'm letting you know this application was vibe-coded in 30 minutes, but it solves my problem and maybe yours too; feel free to improve it to meet your neds. I may look at PRs, but you'll likely just want to fork instead**

# BookScan - Mobile Book Collection Manager

A mobile-friendly web application for scanning ISBN barcodes and managing book collections. Built with TypeScript and HTML5, all data is stored locally using localStorage.

## Features

- 📚 **Collection Management**: Create, rename, and delete book collections
- 📷 **Barcode Scanning**: Scan ISBN/EAN-13 barcodes using device camera
- 🔍 **ISBN Capture**: Scanned ISBNs are recorded directly — no book-details lookup, no third-party book APIs
- ✏️ **Manual Entry**: Add books manually if scanning isn't available
- 📱 **Mobile-First Design**: Touch-friendly interface optimized for small screens
- 💾 **Local Storage**: All data stored locally, no backend required
- 🚀 **Offline-Ready**: Scanning and local storage work without internet (Google Sheet sync needs a connection)
- 🔄 **Google Sheet Sync (optional)**: Automatically send scanned/added books to a Google Sheet via a Google Apps Script Web App

## Technologies Used

- **TypeScript**: Type-safe JavaScript
- **HTML5 & CSS3**: Modern web standards
- **zxing-wasm**: Barcode scanning via zxing-cpp compiled to WebAssembly (reliable EAN-13 decoding on iOS and Android alike)
- **localStorage**: Client-side data persistence

## Project Structure

```
bookScan/
├── src/
│   ├── app.ts          # Main application logic
│   ├── types.ts        # TypeScript interfaces
│   ├── storage.ts      # localStorage management
│   ├── scanner.ts      # Barcode scanning service
│   ├── export.ts       # CSV export
│   ├── sync.ts         # Google Sheet sync (Apps Script Web App)
│   └── utils.ts        # UI utilities
├── dist/               # Compiled JavaScript (generated)
├── index.html          # Main HTML file
├── styles.css          # Mobile-first CSS
├── package.json        # Dependencies
└── tsconfig.json       # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Modern web browser with camera support

### Installation

1. Install dependencies:
```bash
npm install
```

2. Compile TypeScript:
```bash
npm run build
```

### Running the Application

#### Development Mode

Watch for changes and recompile automatically:
```bash
npm run watch
```

Then serve the application using a local web server:
```bash
npm run serve
```

Open your browser to `http://localhost:8080`

#### Production

For production deployment, simply host the following files on any web server:
- `index.html`
- `styles.css`
- `dist/` directory (includes `zxing_reader.wasm`, copied there by `npm run build`)

> **Note**: For camera access, your site must be served over HTTPS (except for localhost during development).

## Usage

### Creating a Collection

1. Click "**+ New Collection**" button
2. Enter a name for your collection
3. Click "**Create**"

### Adding Books

#### Via Barcode Scanning

1. Open a collection
2. Click "**📷 Scan Book**"
3. Grant camera permissions if prompted
4. Point camera at ISBN barcode
5. The ISBN is recorded in the collection and synced to your Google Sheet (if sync is enabled)

#### Manual Entry

Use this when scanning isn't available (no camera, damaged barcode, etc.).

1. Open a collection
2. Click "**✏️ Add Manually**"
3. Type the ISBN
4. Click "**Add Book**"

### Managing Collections

- **Rename**: Click menu icon (⋮) → "✏️ Rename"
- **Delete**: Click menu icon (⋮) → "🗑️ Delete Collection"

### Managing Books

- **Delete**: Click the 🗑️ icon on any book card

## Supported Barcodes

- ISBN-13 (EAN-13)
- ISBN-10

The scanner is specifically configured to recognize ISBN barcodes used on books.

## API Usage

There is deliberately **no book-details lookup**: a scan records the ISBN itself (locally
and to the synced Google Sheet). Book metadata lives in the Sheet, which is the system of
record — earlier versions fetched details from Google Books, but Google reduced the
keyless quota to zero and the lookup added failure modes for no benefit to this workflow.

### Google Sheet Sync (optional)

BookScan is a static site with no backend, so it can't safely hold a Google service-account
key. Instead, sync works by POSTing to a **Google Apps Script Web App** that you deploy
yourself, bound to your own Sheet:

1. Open the target Google Sheet.
2. **Extensions > Apps Script**. This binds the script to the spreadsheet you opened it
   from, so it can use `SpreadsheetApp.getActiveSpreadsheet()` without hardcoding the
   spreadsheet ID.
3. Find the **gid** of the specific tab you want to sync into: open that tab in the browser
   and look at the URL, e.g. `.../edit?gid=952194812#gid=952194812` → gid is `952194812`.
   A spreadsheet can have multiple tabs, and `gid` is how you pin the script to one specific
   tab regardless of which tab happens to be open when the script runs.
4. Decide which column the ISBN goes in (as a 1-indexed column number — A=1, B=2, … F=6),
   and paste in:
   ```javascript
   function doPost(e) {
     var SHEET_GID = 952194812;    // the tab's gid from its URL
     var ISBN_COLUMN = 6;          // column F

     var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()
       .find(function (s) { return s.getSheetId() === SHEET_GID; });

     if (!sheet) {
       return ContentService.createTextOutput(
         JSON.stringify({ status: 'error', message: 'No tab with gid ' + SHEET_GID })
       ).setMimeType(ContentService.MimeType.JSON);
     }

     var data = JSON.parse(e.postData.contents);
     var isbn = (data.isbn || '').toString().trim();
     if (!isbn) {
       return ContentService.createTextOutput(
         JSON.stringify({ status: 'error', message: 'Missing isbn' })
       ).setMimeType(ContentService.MimeType.JSON);
     }

     // Only write into a row where every column is empty — a row that has
     // data in ANY column (not just F) is considered "used" and skipped, so
     // this never overwrites a row you've filled in by hand elsewhere.
     var targetRow = sheet.getLastRow() + 1;

     sheet.getRange(targetRow, ISBN_COLUMN).setValue(isbn);

     return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```
5. **Deploy > New deployment** → type **Web app** → Execute as **Me** → Who has access **Anyone**.
6. Copy the resulting `.../exec` URL.
7. In BookScan, tap the ⚙️ settings icon, check "Enable sync", paste the URL, and tap
   **Send Test** — check the target tab's column F for a `0000000000000` row before
   tapping Save, so you know the pipeline actually works end to end (right tab, right
   column). Delete that test row afterward.
8. Tap **Save**.

Every book you scan or add manually now has its ISBN sent to that tab's column F in the
background, with a toast confirming the request was sent (or failed to send).

**Where sync settings live and when it fires**: `{ enabled, webAppUrl }` is stored under the
localStorage key `bookScan_syncSettings` (separate from the `bookScan_collections` book data).
`SyncService.syncBook()` is called from two places in `app.ts`, both *after* the book is
already saved locally: `handleScannedISBN()` (after a barcode scan) and
`handleAddManualBook()` (after manual entry) — so a failed or slow sync never blocks adding
the book itself.

**Payload sent per book**: just `{ "isbn": "9780143127550" }` — nothing else. Earlier versions
also sent `timestamp`/`collection`/`title`/`authors`/`publisher`/`publishedDate`, but since
both scanning and manual entry are ISBN-only (see [API Usage](#api-usage) above), those fields
were always empty or a duplicate of the ISBN, so they were dropped from the payload entirely.
If you need per-collection routing or a timestamp column later, that's a real gap — see
`TODO.md`.

**Important limitation**: Apps Script Web Apps don't return browser-readable CORS responses,
so the app sends the request with `mode: 'no-cors'` and can't read the result. This means a
"synced" toast only confirms the request went out — not that Apps Script actually wrote the
row (e.g. a typo'd sheet name or a script error on the Apps Script side is invisible to the
app). Check your Sheet directly to confirm data is arriving as expected — the **Send Test**
button in Settings is the fastest way to check this at any time.

**If you edit your Apps Script code later**: saving the script does *not* update an
already-deployed Web App. Go to **Deploy → Manage deployments** → edit (pencil icon) your
deployment → set **Version: New version** → **Deploy**, or the live URL keeps running the
old code. This is the most common reason sync silently "sends" but nothing shows up in the
Sheet.

## Browser Compatibility

- ✅ Chrome/Edge (Android/Desktop)
- ✅ Safari (iOS/macOS)
- ✅ Firefox (Android/Desktop)
- ⚠️ Requires camera permissions for scanning

## Mobile Optimization

- Minimum tap target size: 48×48px
- Large, easy-to-tap buttons
- Responsive grid layout
- Touch-friendly gestures
- No accidental text selection
- Optimized viewport for mobile devices

## Data Storage

All data is stored in browser localStorage:
- **Key**: `bookScan_collections`
- **Format**: JSON array of collections
- **Persistence**: Data persists until explicitly cleared by user
- **Capacity**: Typically 5-10MB per domain (browser-dependent)

## Remaining Tasks

See TODO.md for detailed implementation tasks and future enhancements.

## Known Limitations

1. **Storage**: Limited by browser localStorage capacity
2. **Offline**: Sync to Google Sheets needs an internet connection (scans still record locally)
3. **Camera**: Requires device with camera and HTTPS connection
4. **Import**: CSV export is supported, but there's no import path back in yet
5. **No book metadata**: scans record the ISBN only — titles/authors etc. live in your Sheet
6. **Sync confirmation**: Google Sheet sync can't confirm the write succeeded (see Google Sheet Sync section above)

## Future Enhancements

- [ ] Import collections from JSON or CSV
- [ ] Barcode scanning from image files
- [ ] Book cover upload for manual entries
- [ ] Search within collections
- [ ] Sort and filter options
- [ ] Statistics and reading progress tracking
- [ ] Dark mode support
- [ ] PWA support for offline functionality
- [ ] Bulk operations (delete multiple books)

## Troubleshooting

### Camera Not Working

- Ensure you're accessing via HTTPS (or localhost)
- Grant camera permissions in browser settings
- Check if other apps can access the camera
- Try a different browser

### Barcode Won't Scan

- Hold the phone steady ~15–20 cm from the barcode and let the camera focus
- Make sure the whole barcode fits inside the scan box
- Improve lighting; avoid glare on glossy covers
- Fall back to "✏️ Add Manually" and type the ISBN

### Storage Full

- Clear browser cache and data
- Export collections to CSV first (📥 button) to keep a backup
- Delete unused collections

## License

MIT License - Feel free to use and modify for your projects.

## Contributing

Contributions welcome! Please feel free to submit issues or pull requests.

## Acknowledgments

- [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) / [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp)
