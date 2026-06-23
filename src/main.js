import "@arcgis/core/assets/esri/themes/light/main.css";
import "./style.css";

import esriConfig from "@arcgis/core/config.js";
import Graphic from "@arcgis/core/Graphic.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import ArcGISMap from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import * as locator from "@arcgis/core/rest/locator.js";
import {
  Archive,
  Download,
  FileText,
  FileUp,
  Globe2,
  KeyRound,
  MapPin,
  Play,
  Search,
  createIcons
} from "lucide";
import * as shpwriteModule from "@mapbox/shp-write";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";

const ESRI_API_KEY = "BURAYA_API_KEY_GELECEK";
const GEOCODING_SERVICE_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
const GEOCODE_FIELDS = ["Geocode address", "Latitude", "Longitude", "Match address", "Score", "Geocode status"];
const SUMMARY_FIELDS = ["Geocode kolonu", "Kolon değeri", "Geocode address", "Match address", "Score", "Latitude", "Longitude", "Status"];
const PLACEHOLDER_KEY = "BURAYA_API_KEY_GELECEK";

const shpwrite = shpwriteModule.default ?? shpwriteModule;

const elements = {
  fileInput: document.querySelector("#fileInput"),
  fileName: document.querySelector("#fileName"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  countryCodeInput: document.querySelector("#countryCodeInput"),
  delayInput: document.querySelector("#delayInput"),
  storeResultsInput: document.querySelector("#storeResultsInput"),
  columnSelector: document.querySelector("#columnSelector"),
  addressPreview: document.querySelector("#addressPreview"),
  geocodeButton: document.querySelector("#geocodeButton"),
  progressLabel: document.querySelector("#progressLabel"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  messageBox: document.querySelector("#messageBox"),
  totalCount: document.querySelector("#totalCount"),
  successCount: document.querySelector("#successCount"),
  failedCount: document.querySelector("#failedCount"),
  lowScoreCount: document.querySelector("#lowScoreCount"),
  summaryStatus: document.querySelector("#summaryStatus"),
  boxSelectButton: document.querySelector("#boxSelectButton"),
  clearSelectionButton: document.querySelector("#clearSelectionButton"),
  selectionStatus: document.querySelector("#selectionStatus"),
  selectionBox: document.querySelector("#selectionBox"),
  tableSearchInput: document.querySelector("#tableSearchInput"),
  filterSelect: document.querySelector("#filterSelect"),
  scoreThresholdInput: document.querySelector("#scoreThresholdInput"),
  summaryTable: document.querySelector("#summaryTable"),
  summaryCols: document.querySelector("#summaryCols"),
  summaryHead: document.querySelector("#summaryHead"),
  summaryBody: document.querySelector("#summaryBody"),
  resultsTable: document.querySelector("#resultsTable"),
  tableCols: document.querySelector("#tableCols"),
  tableHead: document.querySelector("#tableHead"),
  tableBody: document.querySelector("#tableBody"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportKmlButton: document.querySelector("#exportKmlButton"),
  exportShpButton: document.querySelector("#exportShpButton")
};

let headers = [];
let sourceRows = [];
let resultRows = [];
let selectedColumns = [];
let selectedRowId = null;
let spatialFilterRowIds = null;
let isBoxSelectMode = false;
let boxSelectStart = null;
let isGeocoding = false;

const graphicsLayer = new GraphicsLayer({ title: "Geocode Sonuçları" });
const map = new ArcGISMap({
  basemap: "topo-vector",
  layers: [graphicsLayer]
});

const view = new MapView({
  container: "mapView",
  map,
  center: [35.24, 39.06],
  zoom: 6,
  constraints: {
    snapToZoom: false
  },
  popup: {
    dockEnabled: true,
    dockOptions: {
      buttonEnabled: false,
      position: "top-right"
    }
  }
});

createIcons({
  icons: {
    Archive,
    Download,
    FileText,
    FileUp,
    Globe2,
    KeyRound,
    MapPin,
    Play,
    Search
  }
});

if (ESRI_API_KEY && ESRI_API_KEY !== PLACEHOLDER_KEY) {
  elements.apiKeyInput.value = ESRI_API_KEY;
}

elements.fileInput.addEventListener("change", handleFileSelection);
elements.columnSelector.addEventListener("change", handleColumnSelection);
elements.geocodeButton.addEventListener("click", geocodeRows);
elements.boxSelectButton.addEventListener("click", toggleBoxSelectMode);
elements.clearSelectionButton.addEventListener("click", clearSpatialSelection);
elements.tableSearchInput.addEventListener("input", renderTables);
elements.filterSelect.addEventListener("change", renderTables);
elements.scoreThresholdInput.addEventListener("input", () => {
  renderStats();
  renderTables();
  refreshGraphicSymbols();
});
elements.exportCsvButton.addEventListener("click", exportCsv);
elements.exportKmlButton.addEventListener("click", exportKml);
elements.exportShpButton.addEventListener("click", exportShp);

view.on("click", async (event) => {
  const hit = await view.hitTest(event);
  const graphicHit = hit.results.find((result) => result.graphic?.layer === graphicsLayer);

  if (graphicHit?.graphic?.attributes?.__rowId) {
    selectRow(graphicHit.graphic.attributes.__rowId, { fromMap: true });
  }
});

view.on("drag", (event) => {
  if (!isBoxSelectMode) {
    return;
  }

  event.stopPropagation();
  handleBoxSelectDrag(event);
});

async function handleFileSelection(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  resetStateForNewFile();
  elements.fileName.textContent = file.name;
  setMessage("Dosya okunuyor...", "info");

  try {
    const parsedRows = await readWorkbookRows(file);

    if (!parsedRows.length) {
      throw new Error("Dosyada okunabilir satır bulunamadı.");
    }

    sourceRows = parsedRows.map(normalizeRow);
    headers = Object.keys(sourceRows[0]);
    selectedColumns = [];
    clearSpatialSelection({ silent: true });

    renderColumnSelector();
    resultRows = sourceRows.map(createPendingResult);
    renderStats();
    renderTables();
    updateAddressPreview();
    updateActionStates();
    setMessage(`${sourceRows.length} kayıt yüklendi.`, "success");
  } catch (error) {
    setMessage(error.message || "Dosya okunamadı.", "error");
    resetStateForNewFile();
  }
}

async function readWorkbookRows(file) {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("tr-TR");

  if (extension === "csv") {
    return readCsvRows(file);
  }

  if (extension === "xlsx") {
    return readXlsxRows(file);
  }

  throw new Error("Yalnızca CSV veya XLSX dosyası destekleniyor.");
}

function readCsvRows(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: "greedy",
      complete: (result) => {
        if (result.errors.length) {
          reject(new Error(result.errors[0].message || "CSV dosyası okunamadı."));
          return;
        }

        resolve(convertMatrixToRows(result.data));
      },
      error: (error) => reject(error)
    });
  });
}

async function readXlsxRows(file) {
  const matrix = await readXlsxFile(file);
  return convertMatrixToRows(matrix);
}

function convertMatrixToRows(matrix) {
  const rows = normalizeMatrix(matrix);
  const nonEmptyRows = rows.filter((row) => row.some((cell) => stringifyCell(cell)));

  if (!nonEmptyRows.length) {
    return [];
  }

  const [headerRow, ...dataRows] = nonEmptyRows;
  const columnNames = makeUniqueHeaders(headerRow);

  return dataRows
    .filter((row) => row.some((cell) => stringifyCell(cell)))
    .map((row) =>
      Object.fromEntries(columnNames.map((columnName, index) => [columnName, stringifyCell(row[index])]))
    );
}

function normalizeMatrix(matrix) {
  let rows = matrix;

  if (Array.isArray(rows) && rows.length === 1 && Array.isArray(rows[0]?.data)) {
    rows = rows[0].data;
  } else if (Array.isArray(rows?.data)) {
    rows = rows.data;
  } else if (Array.isArray(rows?.rows)) {
    rows = rows.rows;
  }

  if (!Array.isArray(rows)) {
    rows = [];
  }

  return rows.map((row) => {
    if (Array.isArray(row)) {
      return row;
    }

    if (row && typeof row === "object") {
      return Object.values(row);
    }

    return [row];
  });
}

function makeUniqueHeaders(headerRow) {
  const used = new Map();

  return headerRow.map((cell, index) => {
    const baseName = stringifyCell(cell) || `Kolon ${index + 1}`;
    const count = used.get(baseName) || 0;
    used.set(baseName, count + 1);

    return count ? `${baseName}_${count + 1}` : baseName;
  });
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => String(key).trim())
      .map(([key, value]) => [String(key).trim(), stringifyCell(value)])
  );
}

function stringifyCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function renderColumnSelector() {
  if (!headers.length) {
    elements.columnSelector.className = "column-selector empty-state";
    elements.columnSelector.textContent = "Dosya yüklendiğinde kolonlar burada görünecek.";
    return;
  }

  elements.columnSelector.className = "column-selector";
  elements.columnSelector.innerHTML = `
    <label class="field column-select-field">
      <span>Adres kolonu</span>
      <select id="addressColumnSelect">
        <option value="">Kolon seçin</option>
        ${headers
          .map((header) => {
            const selected = selectedColumns.includes(header) ? "selected" : "";
            return `<option value="${escapeAttribute(header)}" ${selected}>${escapeHtml(header)}</option>`;
          })
          .join("")}
      </select>
    </label>
  `;
}

function handleColumnSelection() {
  const selectedColumn = elements.columnSelector.querySelector("#addressColumnSelect")?.value || "";
  selectedColumns = selectedColumn ? [selectedColumn] : [];
  resultRows = sourceRows.map(createPendingResult);
  graphicsLayer.removeAll();
  clearSpatialSelection({ silent: true });
  selectedRowId = null;
  updateAddressPreview();
  renderStats();
  renderTables();
  updateActionStates();
}

function createPendingResult(row, index) {
  return {
    id: `row-${index + 1}`,
    source: row,
    address: buildAddress(row),
    latitude: null,
    longitude: null,
    matchAddress: "",
    score: null,
    status: "Bekliyor",
    message: ""
  };
}

function buildAddress(row) {
  return selectedColumns
    .map((column) => row[column])
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function updateAddressPreview() {
  const firstRow = sourceRows[0];
  elements.addressPreview.textContent = firstRow && selectedColumns.length ? buildAddress(firstRow) || "-" : "-";
}

async function geocodeRows() {
  if (isGeocoding) {
    return;
  }

  if (!sourceRows.length) {
    setMessage("Önce CSV veya Excel dosyası yükleyin.", "error");
    return;
  }

  if (!selectedColumns.length) {
    setMessage("Adres oluşturmak için en az bir kolon seçin.", "error");
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    setMessage("Esri API key eksik. Kodda ESRI_API_KEY değerini değiştirin veya alana girin.", "error");
    return;
  }

  isGeocoding = true;
  esriConfig.apiKey = apiKey;
  graphicsLayer.removeAll();
  clearSpatialSelection({ silent: true });
  selectedRowId = null;
  resultRows = sourceRows.map(createPendingResult);
  updateActionStates();
  setMessage("Geocoding başladı.", "info");

  const countryCode = elements.countryCodeInput.value.trim().toUpperCase();
  const delay = Math.max(0, Number(elements.delayInput.value) || 0);
  const forStorage = elements.storeResultsInput.checked;
  let abortMessage = "";

  for (let index = 0; index < resultRows.length; index += 1) {
    const row = resultRows[index];

    if (!row.address) {
      markFailed(row, "Adres alanı boş.");
      updateProgress(index + 1, resultRows.length);
      continue;
    }

    try {
      const geocodeResult = await geocodeAddress(row.address, countryCode, forStorage);

      if (geocodeResult) {
        markSuccessful(row, geocodeResult);
        addGraphic(row);
      } else {
        markFailed(row, "Eşleşen aday bulunamadı.");
      }
    } catch (error) {
      const errorMessage = getGeocodeErrorMessage(error);
      markFailed(row, errorMessage);

      if (isStoragePermissionError(error)) {
        abortMessage = `${errorMessage} Sonuçları saklama iznini kapatıp tekrar deneyin.`;
        setMessage(abortMessage, "error");
        break;
      }
    }

    updateProgress(index + 1, resultRows.length);

    if (index % 5 === 0 || index === resultRows.length - 1) {
      renderStats();
      renderTables();
    }

    if (delay && index < resultRows.length - 1) {
      await sleep(delay);
    }
  }

  isGeocoding = false;
  await zoomToResults();
  renderStats();
  renderTables();
  updateActionStates();
  setMessage(abortMessage || "Geocoding tamamlandı.", abortMessage ? "error" : "success");
}

async function geocodeAddress(address, countryCode, forStorage) {
  const params = {
    address: {
      SingleLine: address
    },
    maxLocations: 1,
    outFields: ["*"],
    outSpatialReference: {
      wkid: 4326
    }
  };

  if (countryCode) {
    params.countryCode = countryCode;
  }

  if (forStorage) {
    params.forStorage = true;
  }

  const candidates = await locator.addressToLocations(GEOCODING_SERVICE_URL, params);
  const candidate = candidates?.[0];

  if (!candidate?.location) {
    return null;
  }

  const longitude = Number(candidate.location.longitude ?? candidate.location.x);
  const latitude = Number(candidate.location.latitude ?? candidate.location.y);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    matchAddress: candidate.address || "",
    score: Number(candidate.score ?? 0)
  };
}

function getGeocodeErrorMessage(error) {
  const serviceError = error?.details?.error || error?.error || error?.details?.messages?.[0];
  const details = serviceError?.details || error?.details?.details || error?.details;
  const detailText = Array.isArray(details) ? details.filter(Boolean).join(" ") : "";
  const message = serviceError?.message || error?.message || "Geocoding servisi hata döndürdü.";

  return [message, detailText].filter(Boolean).join(" ");
}

function isStoragePermissionError(error) {
  return /permissions to store geocoding results|access is denied|forStorage/i.test(getGeocodeErrorMessage(error));
}

function markSuccessful(row, result) {
  row.latitude = result.latitude;
  row.longitude = result.longitude;
  row.matchAddress = result.matchAddress;
  row.score = result.score;
  row.status = "Başarılı";
  row.message = "";
}

function markFailed(row, message) {
  row.latitude = null;
  row.longitude = null;
  row.matchAddress = "";
  row.score = null;
  row.status = "Başarısız";
  row.message = message;
}

function addGraphic(row) {
  const graphic = new Graphic({
    geometry: {
      type: "point",
      x: row.longitude,
      y: row.latitude,
      longitude: row.longitude,
      latitude: row.latitude,
      spatialReference: {
        wkid: 4326
      }
    },
    symbol: getSymbol(row),
    attributes: buildGraphicAttributes(row),
    popupTemplate: {
      title: row.matchAddress || row.address,
      content: buildPopupContent(row)
    }
  });

  graphicsLayer.add(graphic);
  return graphic;
}

function buildGraphicAttributes(row) {
  return {
    __rowId: row.id,
    ...row.source,
    "Geocode address": row.address,
    Latitude: row.latitude,
    Longitude: row.longitude,
    "Match address": row.matchAddress,
    Score: row.score,
    "Geocode status": row.status
  };
}

function buildPopupContent(row) {
  const fields = buildExportRow(row);
  const rows = Object.entries(fields)
    .map(([key, value]) => `
      <tr>
        <th>${escapeHtml(key)}</th>
        <td>${escapeHtml(formatCell(value))}</td>
      </tr>
    `)
    .join("");

  return `<table class="popup-table">${rows}</table>`;
}

function getSymbol(row) {
  const isSelected = selectedRowId === row.id;
  const lowScore = isLowScore(row);

  return {
    type: "simple-marker",
    style: "circle",
    size: isSelected ? 15 : 10,
    color: isSelected ? [230, 57, 70, 0.95] : lowScore ? [242, 169, 59, 0.95] : [19, 128, 123, 0.95],
    outline: {
      color: [255, 255, 255, 0.95],
      width: isSelected ? 2.5 : 1.5
    }
  };
}

function selectRow(rowId, options = {}) {
  selectedRowId = rowId;
  refreshGraphicSymbols();
  renderTables();

  const row = resultRows.find((item) => item.id === rowId);
  if (!row) {
    return;
  }

  const tableRow = document.querySelector(`tr[data-row-id="${CSS.escape(rowId)}"]`);
  tableRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });

  const graphic = graphicsLayer.graphics.toArray().find((item) => item.attributes.__rowId === rowId);
  if (!options.fromMap && graphic) {
    view.goTo(
      {
        target: graphic.geometry,
        zoom: 17
      },
      {
        duration: 550
      }
    ).catch(() => {});

    openPopup(graphic);
  }
}

function openPopup(graphic) {
  if (typeof view.openPopup === "function") {
    view.openPopup({
      features: [graphic],
      location: graphic.geometry
    });
    return;
  }

  view.popup?.open?.({
    features: [graphic],
    location: graphic.geometry
  });
}

function toggleBoxSelectMode() {
  if (!graphicsLayer.graphics.length) {
    setMessage("Dikdörtgen seçim için önce başarılı geocode sonucu olmalı.", "error");
    return;
  }

  setBoxSelectMode(!isBoxSelectMode);
}

function setBoxSelectMode(isActive) {
  isBoxSelectMode = isActive;
  boxSelectStart = null;
  hideSelectionBox();
  elements.boxSelectButton.classList.toggle("active", isActive);
  updateSelectionStatus();
}

function clearSpatialSelection(options = {}) {
  spatialFilterRowIds = null;
  setBoxSelectMode(false);

  if (!options.silent) {
    renderTables();
    setMessage("Harita seçimi temizlendi. Tüm kayıtlar gösteriliyor.", "info");
  }
}

function handleBoxSelectDrag(event) {
  const point = { x: event.x, y: event.y };

  if (event.action === "start") {
    boxSelectStart = point;
    updateSelectionBox(boxSelectStart, point);
    return;
  }

  if (!boxSelectStart) {
    return;
  }

  updateSelectionBox(boxSelectStart, point);

  if (event.action === "end") {
    const bounds = getScreenBounds(boxSelectStart, point);
    setBoxSelectMode(false);
    applyRectangleSelection(bounds);
  }
}

function applyRectangleSelection(bounds) {
  const selectedIds = graphicsLayer.graphics
    .toArray()
    .filter((graphic) => {
      const screenPoint = view.toScreen(graphic.geometry);
      return (
        screenPoint &&
        screenPoint.x >= bounds.left &&
        screenPoint.x <= bounds.right &&
        screenPoint.y >= bounds.top &&
        screenPoint.y <= bounds.bottom
      );
    })
    .map((graphic) => graphic.attributes.__rowId)
    .filter(Boolean);

  spatialFilterRowIds = new Set(selectedIds);

  if (selectedRowId && !spatialFilterRowIds.has(selectedRowId)) {
    selectedRowId = null;
    refreshGraphicSymbols();
  }

  renderTables();
  updateSelectionStatus();
  setMessage(`${selectedIds.length} kayıt seçildi. Tablolar harita seçimine göre filtrelendi.`, selectedIds.length ? "success" : "info");
}

function updateSelectionBox(start, current) {
  const bounds = getScreenBounds(start, current);
  Object.assign(elements.selectionBox.style, {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.right - bounds.left}px`,
    height: `${bounds.bottom - bounds.top}px`
  });
  elements.selectionBox.hidden = false;
}

function hideSelectionBox() {
  elements.selectionBox.hidden = true;
}

function getScreenBounds(start, current) {
  return {
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    right: Math.max(start.x, current.x),
    bottom: Math.max(start.y, current.y)
  };
}

function updateSelectionStatus() {
  const selectedCount = spatialFilterRowIds?.size ?? 0;
  elements.clearSelectionButton.disabled = !spatialFilterRowIds;

  if (isBoxSelectMode) {
    elements.selectionStatus.textContent = "Haritada sürükle";
    return;
  }

  elements.selectionStatus.textContent = spatialFilterRowIds ? `${selectedCount} kayıt seçildi` : "Tüm kayıtlar";
}

function refreshGraphicSymbols() {
  graphicsLayer.graphics.forEach((graphic) => {
    const row = resultRows.find((item) => item.id === graphic.attributes.__rowId);
    if (row) {
      graphic.symbol = getSymbol(row);
    }
  });
}

async function zoomToResults(options = {}) {
  const graphics = graphicsLayer.graphics.toArray();
  if (!graphics.length) {
    return;
  }

  const duration = options.duration ?? 700;
  const target = graphics.length === 1 ? graphics[0].geometry : graphics;
  await view.goTo(
    {
      target,
      zoom: graphics.length === 1 ? 16 : undefined,
      padding: {
        top: 80,
        right: 80,
        bottom: 80,
        left: 80
      }
    },
    {
      duration
    }
  ).catch(() => {});
}

function renderStats() {
  const success = resultRows.filter((row) => row.status === "Başarılı").length;
  const failed = resultRows.filter((row) => row.status === "Başarısız").length;
  const lowScore = resultRows.filter(isLowScore).length;

  elements.totalCount.textContent = resultRows.length;
  elements.successCount.textContent = success;
  elements.failedCount.textContent = failed;
  elements.lowScoreCount.textContent = lowScore;

  if (!sourceRows.length) {
    elements.summaryStatus.textContent = "Dosya bekleniyor";
  } else if (isGeocoding) {
    elements.summaryStatus.textContent = "Geocoding sürüyor";
  } else {
    elements.summaryStatus.textContent = `${sourceRows.length} kayıt hazır`;
  }
}

function renderTables() {
  renderSummaryTable();
  renderTable();
}

function renderSummaryTable() {
  const rows = getFilteredRows();
  const columnWidths = [170, 240, 260, 280, 90, 120, 120, 130];
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0);

  elements.summaryTable.style.setProperty("--results-table-width", `${tableWidth}px`);
  elements.summaryCols.innerHTML = columnWidths.map((width) => `<col style="width: ${width}px" />`).join("");
  elements.summaryHead.innerHTML = `
    <tr>
      ${SUMMARY_FIELDS.map((header) => `<th title="${escapeAttribute(header)}">${escapeHtml(header)}</th>`).join("")}
    </tr>
  `;

  if (!rows.length) {
    elements.summaryBody.innerHTML = `
      <tr>
        <td class="empty-table-cell" colspan="${SUMMARY_FIELDS.length}">Gösterilecek kayıt yok.</td>
      </tr>
    `;
    return;
  }

  elements.summaryBody.innerHTML = rows
    .map((row) => {
      const selectedColumn = selectedColumns[0] || "";
      const cells = [
        selectedColumn,
        selectedColumn ? row.source[selectedColumn] : "",
        row.address,
        row.matchAddress,
        row.score,
        row.latitude,
        row.longitude,
        row.status
      ];
      const statusClass = row.status === "Başarılı" ? "status-success" : row.status === "Başarısız" ? "status-failed" : "status-pending";
      const selectedClass = selectedRowId === row.id ? "selected" : "";

      return `
        <tr data-row-id="${escapeAttribute(row.id)}" class="${selectedClass}">
          ${cells
            .map((cell, index) => {
              const value = formatCell(cell);
              const className = index === cells.length - 1 ? ` class="${statusClass}"` : "";
              return `<td${className} title="${escapeAttribute(value)}">${escapeHtml(value)}</td>`;
            })
            .join("")}
        </tr>
      `;
    })
    .join("");

  elements.summaryBody.querySelectorAll("tr[data-row-id]").forEach((rowElement) => {
    rowElement.addEventListener("click", () => selectRow(rowElement.dataset.rowId));
  });
}

function renderTable() {
  const rows = getFilteredRows();
  const tableHeaders = [...headers, ...GEOCODE_FIELDS];
  const columnWidths = tableHeaders.map(getTableColumnWidth);
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0);

  elements.resultsTable.style.setProperty("--results-table-width", `${tableWidth}px`);
  elements.tableCols.innerHTML = columnWidths.map((width) => `<col style="width: ${width}px" />`).join("");

  elements.tableHead.innerHTML = `
    <tr>
      ${tableHeaders.map((header) => `<th title="${escapeAttribute(header)}">${escapeHtml(header)}</th>`).join("")}
    </tr>
  `;

  if (!rows.length) {
    elements.tableBody.innerHTML = `
      <tr>
        <td class="empty-table-cell" colspan="${tableHeaders.length || 1}">Gösterilecek kayıt yok.</td>
      </tr>
    `;
    return;
  }

  elements.tableBody.innerHTML = rows
    .map((row) => {
      const cells = [
        ...headers.map((header) => row.source[header]),
        row.address,
        row.latitude,
        row.longitude,
        row.matchAddress,
        row.score,
        row.status
      ];
      const statusClass = row.status === "Başarılı" ? "status-success" : row.status === "Başarısız" ? "status-failed" : "status-pending";
      const selectedClass = selectedRowId === row.id ? "selected" : "";

      return `
        <tr data-row-id="${escapeAttribute(row.id)}" class="${selectedClass}">
          ${cells
            .map((cell, index) => {
              const value = formatCell(cell);
              const className = index === cells.length - 1 ? ` class="${statusClass}"` : "";
              return `<td${className} title="${escapeAttribute(value)}">${escapeHtml(value)}</td>`;
            })
            .join("")}
        </tr>
      `;
    })
    .join("");

  elements.tableBody.querySelectorAll("tr[data-row-id]").forEach((rowElement) => {
    rowElement.addEventListener("click", () => selectRow(rowElement.dataset.rowId));
  });
}

function getTableColumnWidth(header) {
  const normalizedHeader = normalizeText(header);

  if (["latitude", "longitude", "score"].includes(normalizedHeader) || normalizedHeader.includes("kodu")) {
    return 110;
  }

  if (normalizedHeader.includes("status") || normalizedHeader.includes("durum")) {
    return 140;
  }

  if (
    normalizedHeader.includes("adres") ||
    normalizedHeader.includes("address") ||
    normalizedHeader.includes("unvan") ||
    normalizedHeader.includes("faaliyet") ||
    normalizedHeader.includes("sektor") ||
    normalizedHeader.includes("mahalle") ||
    normalizedHeader.includes("cadde") ||
    normalizedHeader.includes("sokak")
  ) {
    return 280;
  }

  return 160;
}

function getFilteredRows() {
  const query = normalizeText(elements.tableSearchInput.value);
  const filter = elements.filterSelect.value;

  return resultRows.filter((row) => {
    if (spatialFilterRowIds && !spatialFilterRowIds.has(row.id)) {
      return false;
    }

    if (filter === "success" && row.status !== "Başarılı") {
      return false;
    }

    if (filter === "failed" && row.status !== "Başarısız") {
      return false;
    }

    if (filter === "low-score" && !isLowScore(row)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = Object.values(buildExportRow(row)).join(" ");
    return normalizeText(searchable).includes(query);
  });
}

function isLowScore(row) {
  const threshold = Number(elements.scoreThresholdInput.value) || 0;
  return row.status === "Başarılı" && Number(row.score) < threshold;
}

function updateProgress(done, total) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  elements.progressLabel.textContent = `${done} / ${total} adres işlendi`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
}

function updateActionStates() {
  const hasRows = sourceRows.length > 0;
  const hasSelection = selectedColumns.length > 0;
  const hasResults = resultRows.some((row) => row.status !== "Bekliyor");
  const hasSuccessfulResults = resultRows.some((row) => row.status === "Başarılı");

  elements.geocodeButton.disabled = isGeocoding || !hasRows || !hasSelection;
  elements.exportCsvButton.disabled = !hasResults || isGeocoding;
  elements.exportKmlButton.disabled = !hasSuccessfulResults || isGeocoding;
  elements.exportShpButton.disabled = !hasSuccessfulResults || isGeocoding;
}

function exportCsv() {
  if (!resultRows.length) {
    setMessage("CSV için dışa aktarılacak veri yok.", "error");
    return;
  }

  const rows = resultRows.map(buildExportRow);
  const csvHeaders = Object.keys(rows[0]);
  const csv = [
    csvHeaders.join(","),
    ...rows.map((row) => csvHeaders.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");

  downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), "geocode-sonuclari.csv");
  setMessage("CSV oluşturuldu.", "success");
}

function exportKml() {
  const successfulRows = getSuccessfulRows();

  if (!successfulRows.length) {
    setMessage("KML için başarılı geocode kaydı yok.", "error");
    return;
  }

  const placemarks = successfulRows
    .map((row) => {
      const description = Object.entries(buildExportRow(row))
        .map(([key, value]) => `<tr><th>${escapeXml(key)}</th><td>${escapeXml(formatCell(value))}</td></tr>`)
        .join("");

      return `
        <Placemark>
          <name>${escapeXml(row.matchAddress || row.address)}</name>
          <description><![CDATA[<table>${description}</table>]]></description>
          <Point>
            <coordinates>${row.longitude},${row.latitude},0</coordinates>
          </Point>
        </Placemark>
      `;
    })
    .join("");

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Geocode Sonuçları</name>
    ${placemarks}
  </Document>
</kml>`;

  downloadBlob(new Blob([kml], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" }), "geocode-sonuclari.kml");
  setMessage("KML oluşturuldu.", "success");
}

async function exportShp() {
  const successfulRows = getSuccessfulRows();

  if (!successfulRows.length) {
    setMessage("SHP için başarılı geocode kaydı yok.", "error");
    return;
  }

  try {
    const featureCollection = {
      type: "FeatureCollection",
      features: successfulRows.map((row) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [row.longitude, row.latitude]
        },
        properties: buildShapefileProperties(row)
      }))
    };

    const zipBlob = await shpwrite.zip(featureCollection, {
      folder: "geocode-sonuclari",
      outputType: "blob",
      compression: "DEFLATE",
      types: {
        point: "points"
      }
    });
    downloadBlob(zipBlob, "geocode-sonuclari.zip");
    setMessage("SHP dosyası oluşturuldu.", "success");
  } catch (error) {
    setMessage(error.message || "SHP export sırasında hata oluştu.", "error");
  }
}

function buildExportRow(row) {
  return {
    ...row.source,
    "Geocode address": row.address,
    Latitude: row.latitude ?? "",
    Longitude: row.longitude ?? "",
    "Match address": row.matchAddress,
    Score: row.score ?? "",
    "Geocode status": row.status,
    "Hata mesajı": row.message
  };
}

function buildShapefileProperties(row) {
  const usedKeys = new Set();

  return Object.fromEntries(
    Object.entries(buildExportRow(row)).map(([key, value]) => {
      const safeKey = createDbfKey(key, usedKeys);
      usedKeys.add(safeKey);
      return [safeKey, formatCell(value).slice(0, 254)];
    })
  );
}

function createDbfKey(key, usedKeys) {
  const base = normalizeText(key)
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+/, "")
    .slice(0, 10)
    .toUpperCase() || "FIELD";

  let candidate = base;
  let index = 1;

  while (usedKeys.has(candidate)) {
    const suffix = String(index);
    candidate = `${base.slice(0, 10 - suffix.length)}${suffix}`;
    index += 1;
  }

  return candidate;
}

function getSuccessfulRows() {
  return resultRows.filter((row) => row.status === "Başarılı" && Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}

function resetStateForNewFile() {
  headers = [];
  sourceRows = [];
  resultRows = [];
  selectedColumns = [];
  selectedRowId = null;
  clearSpatialSelection({ silent: true });
  graphicsLayer.removeAll();
  updateProgress(0, 0);
  renderColumnSelector();
  renderStats();
  renderTables();
  updateActionStates();
  elements.addressPreview.textContent = "-";
}

function getApiKey() {
  const inputValue = elements.apiKeyInput.value.trim();
  const codeValue = ESRI_API_KEY === PLACEHOLDER_KEY ? "" : ESRI_API_KEY.trim();
  return inputValue || codeValue;
}

function setMessage(message, type = "info") {
  elements.messageBox.textContent = message;
  elements.messageBox.dataset.type = type;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  const stringValue = formatCell(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function formatCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function normalizeText(value) {
  return String(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return formatCell(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

renderStats();
renderTables();
updateActionStates();
updateSelectionStatus();
