# ArcGIS Geocoding Web App

This project is a Vite-based web application for geocoding address data from CSV or Excel files with the ArcGIS Maps SDK for JavaScript and the Esri Geocoding Service.

## What We Built

- File upload support for `.csv` and `.xlsx` datasets.
- Manual address column selection with a dropdown, so the app does not auto-pick address fields.
- Esri API key input and an optional `forStorage` toggle for accounts that are allowed to store geocoding results.
- Row-by-row geocoding with progress feedback and controlled request delay.
- Successful geocode results are added to the map as points while processing continues.
- The map no longer zooms after every point; it zooms once after the full geocoding run is complete.
- An attribute table showing original source fields plus geocoding result fields.
- Tabbed summary and full-data tables, with CSV export for the active filtered table.
- Fixed-height table rows with ellipsis for long values and full values available on hover.
- A larger table area that allows page scrolling to the table, while long record lists scroll inside the table itself.
- Search, status filtering, and low-score filtering.
- CSV, KML, and SHP export for geocoded results.
- Map and table selection sync: selecting a row zooms to its point, and selecting a point highlights the related row.

## Tech Stack

- Vite
- JavaScript
- ArcGIS Maps SDK for JavaScript
- Esri Geocoding Service
- PapaParse for CSV parsing
- read-excel-file for Excel parsing
- shp-write for Shapefile export
- Lucide icons

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## ArcGIS API Key

The app can use an API key entered in the UI. There is also a placeholder constant in `src/main.js`:

```js
const ESRI_API_KEY = "BURAYA_API_KEY_GELECEK";
```

Replace it if you want a default key in code, or leave it as-is and enter the key in the application.

## Notes About Stored Geocoding Results

Esri may return this error when the API key does not have permission to store geocoding results:

```text
Token is valid but access is denied.
User does not have permissions to store geocoding results.
```

To avoid that, the app only sends `forStorage: true` when the "Store results permission" checkbox is enabled.

## Data Flow

1. Upload a CSV or XLSX file.
2. Choose the address column from the dropdown.
3. Enter an Esri API key.
4. Start geocoding.
5. Successful results appear on the map as they arrive.
6. When geocoding finishes, the map zooms to all successful points.
7. Review results in the tabbed tables, export the active table as CSV, or export geocoded results as CSV, KML, or SHP.
