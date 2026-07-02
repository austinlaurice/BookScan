**If not obvious, I'm letting you know this application was vibe-coded in 30 minutes, but it solves my problem and maybe yours too; feel free to improve it to meet your neds. I may look at PRs, but you'll likely just want to fork instead**

# BookScan - Mobile Book Collection Manager

A mobile-friendly web application for scanning ISBN barcodes and managing book collections. Built with TypeScript and HTML5, all data is stored locally using localStorage.

## Features

- 📚 **Collection Management**: Create, rename, and delete book collections
- 📷 **Barcode Scanning**: Scan ISBN/EAN-13 barcodes using device camera
- 🔍 **Automatic Book Details**: Fetches book information from Google Books API
- ✏️ **Manual Entry**: Add books manually if scanning isn't available
- 📱 **Mobile-First Design**: Touch-friendly interface optimized for small screens
- 💾 **Local Storage**: All data stored locally, no backend required
- 🚀 **Offline-Ready**: Works without internet (except for fetching book details)
- 🔄 **Google Sheet Sync (optional)**: Automatically send scanned/added books to a Google Sheet via a Google Apps Script Web App

## Technologies Used

- **TypeScript**: Type-safe JavaScript
- **HTML5 & CSS3**: Modern web standards
- **zxing-wasm**: Barcode scanning via zxing-cpp compiled to WebAssembly (reliable EAN-13 decoding on iOS and Android alike)
- **Google Books API**: Book information retrieval
- **localStorage**: Client-side data persistence

## Project Structure

```
bookScan/
├── src/
│   ├── app.ts          # Main application logic
│   ├── types.ts        # TypeScript interfaces
│   ├── storage.ts      # localStorage management
│   ├── scanner.ts      # Barcode scanning service
│   ├── booksAPI.ts     # Google Books API integration
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
5. Book details are fetched automatically from Google Books API

#### Manual Entry

1. Open a collection
2. Click "**✏️ Add Manually**"
3. Fill in book details (title is required)
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

### Google Books API

The app uses the free Google Books API to fetch book details:
- **Endpoint**: `https://www.googleapis.com/books/v1/volumes`
- **Query**: `?q=isbn:{isbn_number}`
- **No API key required** for basic usage
- **Rate limits**: Standard Google API limits apply

### Google Sheet Sync (optional)

BookScan is a static site with no backend, so it can't safely hold a Google service-account
key. Instead, sync works by POSTing to a **Google Apps Script Web App** that you deploy
yourself, bound to your own Sheet:

1. Create (or open) a Google Sheet.
2. **Extensions > Apps Script**, and paste in:
   ```javascript
   function doPost(e) {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     var data = JSON.parse(e.postData.contents);

     sheet.appendRow([
       data.timestamp || new Date().toISOString(),
       data.collection || '',
       data.title || '',
       data.authors || '',
       data.isbn || '',
       data.publisher || '',
       data.publishedDate || ''
     ]);

     return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. **Deploy > New deployment** → type **Web app** → Execute as **Me** → Who has access **Anyone**.
4. Copy the resulting `.../exec` URL.
5. In BookScan, tap the ⚙️ settings icon, check "Enable sync", paste the URL, and tap
   **Send Test** — check your Sheet for a "Test Book (BookScan sync check)" row before
   tapping Save, so you know the pipeline actually works.
6. Tap **Save**.

Every book you scan or add manually is now also sent to that Sheet in the background,
with a toast confirming the request was sent (or failed to send).

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
2. **Offline**: Cannot fetch book details without internet connection
3. **Camera**: Requires device with camera and HTTPS connection
4. **Import**: CSV export is supported, but there's no import path back in yet
5. **API Limits**: Google Books API has usage limits
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

### Books Not Found

- Verify the ISBN is correct
- Try entering manually
- Check internet connection
- Some books may not be in Google Books database

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
- [Google Books API](https://developers.google.com/books)
