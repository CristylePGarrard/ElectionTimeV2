const DATA_URL = "./data/dashboard_data.json";
const PAGE_SIZE = 12;

const state = {
  allBills: [],
  filteredBills: [],
  page: 1,
  canvasObserver: null
};

const el = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat("en-US");

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function outcomeKind(bill) {
  const outcome = text(bill.outcome).toLowerCase();
  if (outcome === "passed" || outcome.startsWith("passed —") || outcome.startsWith("passed -")) return "Passed";
  if (outcome === "failed") return "Failed";
  return "Unverified";
}

function billDate(bill) {
  const raw = text(bill.display_date);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getFilters() {
  return {
    legislator: el("legislator-select").value,
    chamber: el("chamber-select").value,
    year: el("year-select").value
  };
}

function getBaseBills() {
  const filters = getFilters();
  return state.allBills.filter((bill) => {
    const chamberOkay = filters.chamber === "All" || text(bill.chamber) === filters.chamber;
    const yearOkay = filters.year === "All" || String(bill.year) === filters.year;
    const legislatorOkay = !filters.legislator || text(bill.legislator_name) === filters.legislator;
    return chamberOkay && yearOkay && legislatorOkay;
  });
}

function populateLegislators() {
  const select = el("legislator-select");
  const current = select.value;
  const filters = getFilters();
  const options = unique(state.allBills
    .filter((bill) => filters.chamber === "All" || text(bill.chamber) === filters.chamber)
    .filter((bill) => filters.year === "All" || String(bill.year) === filters.year)
    .map((bill) => text(bill.legislator_name))
    .sort((a, b) => a.localeCompare(b)));

  select.replaceChildren(new Option("All legislators", ""));
  options.forEach((name) => select.add(new Option(name, name)));
  if (options.includes(current)) select.value = current;
}

function renderHeader(bills) {
  const filters = getFilters();
  const selected = filters.legislator;
  const memberRecord = selected ? bills.find((bill) => text(bill.legislator_name) === selected) : null;
  el("view-title").textContent = selected || "All legislators";
  const details = [];
  if (memberRecord?.chamber) details.push(memberRecord.chamber === "House" ? "State House" : "State Senate");
  if (memberRecord?.matched_district !== null && memberRecord?.matched_district !== undefined && text(memberRecord.matched_district)) details.push("District " + text(memberRecord.matched_district));
  if (memberRecord?.matched_party) details.push(text(memberRecord.matched_party));
  if (filters.year !== "All") details.push(filters.year + " session");
  el("view-subtitle").textContent = selected
    ? (details.length ? details.join(" · ") : "Legislator bill records in the selected view.")
    : (filters.year === "All" ? "A look across Utah legislative bill records." : "Bill records for the " + filters.year + " session.");
  el("person-tag").textContent = selected ? (memberRecord?.chamber === "Senate" ? "STATE SENATE" : memberRecord?.chamber === "House" ? "STATE HOUSE" : "LEGISLATOR") : "ALL MEMBERS";
}

function renderStats(bills) {
  const counts = { Passed: 0, Failed: 0, Unverified: 0 };
  bills.forEach((bill) => { counts[outcomeKind(bill)] += 1; });
  const decided = counts.Passed + counts.Failed;
  const rate = decided ? Math.round((counts.Passed / decided) * 100) : null;
  el("stat-sponsored").textContent = numberFormat.format(bills.length);
  el("stat-passed").textContent = numberFormat.format(counts.Passed);
  el("stat-failed").textContent = numberFormat.format(counts.Failed);
  el("stat-rate").textContent = rate === null ? "—" : rate + "%";
  renderOutcomeBars(counts);
}

function renderOutcomeBars(counts) {
  const max = Math.max(counts.Passed, counts.Failed, counts.Unverified, 1);
  const items = [
    { label: "Passed", count: counts.Passed, kind: "passed" },
    { label: "Failed", count: counts.Failed, kind: "failed" },
    { label: "Unverified", count: counts.Unverified, kind: "unverified" }
  ];
  el("outcome-bars").innerHTML = items.map((item) => {
    const width = Math.max(item.count ? 2 : 0, (item.count / max) * 100);
    return '<div class="outcome-row"><span class="outcome-label">' + item.label + '</span><div class="outcome-track"><div class="outcome-fill ' + item.kind + '" style="width:' + width + '%"></div></div><strong class="outcome-count">' + numberFormat.format(item.count) + '</strong></div>';
  }).join("");
}

function renderChart(bills) {
  const canvas = el("year-chart");
  const ctx = canvas.getContext("2d");
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(260, bounds.width);
  const height = Math.max(180, bounds.height);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const years = ["2023", "2024", "2025", "2026"];
  const counts = years.map((year) => bills.filter((bill) => String(bill.year) === year).length);
  const max = Math.max(...counts, 1);
  const pad = { top: 20, right: 10, bottom: 34, left: 36 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const tickCount = 4;

  ctx.font = "10px 'DM Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= tickCount; i++) {
    const value = Math.round(max * (tickCount - i) / tickCount);
    const y = pad.top + plotHeight * i / tickCount;
    ctx.strokeStyle = "#e8eeea";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    ctx.fillStyle = "#859399";
    ctx.fillText(numberFormat.format(value), pad.left - 8, y);
  }

  const slot = plotWidth / years.length;
  const barWidth = Math.min(42, slot * .48);
  counts.forEach((count, i) => {
    const barHeight = (count / max) * plotHeight;
    const x = pad.left + slot * i + (slot - barWidth) / 2;
    const y = pad.top + plotHeight - barHeight;
    ctx.fillStyle = "#1c756d";
    roundedRect(ctx, x, y, barWidth, Math.max(barHeight, count ? 2 : 0), 5);
    ctx.fill();
    ctx.fillStyle = "#52656d";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(years[i], x + barWidth / 2, height - pad.bottom + 12);
    if (count) {
      ctx.fillStyle = "#182e3b";
      ctx.font = "600 10px 'DM Sans', sans-serif";
      ctx.textBaseline = "bottom";
      ctx.fillText(numberFormat.format(count), x + barWidth / 2, y - 5);
      ctx.font = "10px 'DM Mono', monospace";
    }
  });

  el("chart-total").textContent = numberFormat.format(bills.length) + " records";
  el("chart-empty").hidden = bills.length !== 0;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function applyTableFilters(bills) {
  const query = el("bill-search").value.trim().toLowerCase();
  const session = el("session-select").value;
  const outcome = el("outcome-select").value;

  return bills.filter((bill) => {
    const sessionOkay = session === "All" || text(bill.session_type) === session;
    const outcomeOkay = outcome === "All" || outcomeKind(bill) === outcome;
    const searchable = [
      bill.bill_number, bill.bill_key, bill.bill_title, bill.sponsor,
      bill.legislator_name, bill.outcome, bill.year, bill.session_type,
      bill.chamber, bill.matched_party, bill.matched_district
    ].map(text).join(" ").toLowerCase();
    return sessionOkay && outcomeOkay && (!query || searchable.includes(query));
  }).sort((a, b) => safeNumber(b.year) - safeNumber(a.year)
    || text(a.bill_number).localeCompare(text(b.bill_number), undefined, { numeric: true }));
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderTable() {
  const baseBills = getBaseBills();
  state.filteredBills = applyTableFilters(baseBills);
  const total = state.filteredBills.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * PAGE_SIZE;
  const visible = state.filteredBills.slice(start, start + PAGE_SIZE);
  const body = el("bill-table-body");

  el("result-count").textContent = numberFormat.format(total) + (total === 1 ? " bill" : " bills");
  el("page-summary").textContent = total ? "Showing " + (start + 1) + "–" + Math.min(start + PAGE_SIZE, total) + " of " + numberFormat.format(total) + " bills" : "Showing 0 bills";
  el("prev-page").disabled = state.page <= 1;
  el("next-page").disabled = state.page >= pages;

  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="6" class="table-message">No bills match these filters. Try a different search or reset the filters.</td></tr>';
    return;
  }

  body.innerHTML = visible.map((bill) => {
    const kind = outcomeKind(bill);
    const pillClass = kind === "Failed" ? "failed" : kind === "Unverified" ? "unverified" : "";
    const title = text(bill.bill_title) || "Title not available";
    const billNumber = text(bill.bill_number) || text(bill.bill_key) || "Bill";
    const chamber = text(bill.chamber) === "House" ? "State House" : text(bill.chamber) === "Senate" ? "State Senate" : "";
    const sessionType = text(bill.session_type) || "Session";
    const date = billDate(bill);
    const url = text(bill.bill_url);
    const officialLink = /^https:\/\//i.test(url)
      ? '<a class="record-link" href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer">View bill ↗</a>'
      : '<span class="subtext">Link unavailable</span>';
    return '<tr>' +
      '<td><span class="bill-number">' + escapeHtml(billNumber) + '</span><span class="subtext">' + escapeHtml(chamber) + '</span></td>' +
      '<td><div class="bill-title">' + escapeHtml(title) + '</div><span class="subtext">' + escapeHtml(bill.sponsor || "") + '</span></td>' +
      '<td>' + escapeHtml(bill.legislator_name || bill.sponsor || "Unknown") + (bill.matched_party ? '<span class="subtext">' + escapeHtml(bill.matched_party) + (bill.matched_district ? ' · Dist. ' + escapeHtml(bill.matched_district) : '') + '</span>' : '') + '</td>' +
      '<td>' + escapeHtml(bill.year) + '<span class="subtext">' + escapeHtml(sessionType) + '</span>' + (date ? '<span class="subtext">' + escapeHtml(date) + '</span>' : '') + '</td>' +
      '<td><span class="outcome-pill ' + pillClass + '">' + kind + '</span></td>' +
      '<td>' + officialLink + '</td>' +
      '</tr>';
  }).join("");
}

function render() {
  const bills = getBaseBills();
  renderHeader(bills);
  renderStats(bills);
  renderChart(bills);
  renderTable();
}

function onPrimaryFilterChange(changed) {
  if (changed !== "legislator") {
    const current = el("legislator-select").value;
    populateLegislators();
    if (current && [...el("legislator-select").options].some((option) => option.value === current)) {
      el("legislator-select").value = current;
    }
  }
  state.page = 1;
  render();
}

function resetFilters() {
  el("legislator-select").value = "";
  el("chamber-select").value = "All";
  el("year-select").value = "All";
  el("bill-search").value = "";
  el("session-select").value = "All";
  el("outcome-select").value = "All";
  populateLegislators();
  state.page = 1;
  render();
}

function showLoadError(error) {
  console.error("Could not load dashboard data:", error);
  el("data-status").textContent = "Couldn't load data. Check that data/dashboard_data.json exists and contains valid JSON.";
  document.querySelector(".note-dot").classList.add("error");
  el("bill-table-body").innerHTML = '<tr><td colspan="6" class="table-message">The data file could not be loaded. Confirm the JSON file is committed at data/dashboard_data.json.</td></tr>';
  ["stat-sponsored", "stat-passed", "stat-failed", "stat-rate"].forEach((id) => { el(id).textContent = "—"; });
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Data request failed: " + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Expected the JSON file to contain an array of bill records.");

    state.allBills = data.filter((bill) => bill && typeof bill === "object");
    if (!state.allBills.length) throw new Error("The JSON file contains no bill records.");

    el("data-status").textContent = "Loaded " + numberFormat.format(state.allBills.length) + " bill records";
    document.querySelector(".note-dot").classList.add("ready");
    populateLegislators();
    render();

    ["legislator-select", "chamber-select", "year-select"].forEach((id) => {
      el(id).addEventListener("change", () => onPrimaryFilterChange(id === "legislator-select" ? "legislator" : id));
    });
    ["bill-search", "session-select", "outcome-select"].forEach((id) => {
      el(id).addEventListener(id === "bill-search" ? "input" : "change", () => { state.page = 1; renderTable(); });
    });
    el("reset-filters").addEventListener("click", resetFilters);
    el("prev-page").addEventListener("click", () => { state.page -= 1; renderTable(); });
    el("next-page").addEventListener("click", () => { state.page += 1; renderTable(); });
    window.addEventListener("resize", () => renderChart(getBaseBills()));
  } catch (error) {
    showLoadError(error);
  }
}

document.addEventListener("DOMContentLoaded", init);