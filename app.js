const DATA_URL = "./data/dashboard_data.json";
const PAGE_SIZE = 12;

const state = {
  allBills: [],
  filteredBills: [],
  page: 1,
  canvasObserver: null,
  districtMap: null,
  districtLayer: null,
  districtFeatures: [],
  selectedDistrictLayer: null
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
    district: el("district-select").value,
    chamber: el("chamber-select").value,
    year: el("year-select").value
  };
}

function getBaseBills() {
  const filters = getFilters();

  return state.allBills.filter((bill) => {
    const chamberOkay =
      filters.chamber === "All" ||
      text(bill.chamber) === filters.chamber;

    const yearOkay =
      filters.year === "All" ||
      String(bill.year) === filters.year;

    const legislatorOkay =
      !filters.legislator ||
      text(bill.legislator_name) === filters.legislator;

    const districtOkay =
      !filters.district ||
      (
        text(bill.chamber) + "|" + text(bill.matched_district)
      ) === filters.district;

    return chamberOkay && yearOkay && legislatorOkay && districtOkay;
  });
}

function populateLegislators() {
  const select = el("legislator-select");
  const current = select.value;
  const filters = getFilters();

  const options = unique(
    state.allBills
      .filter((bill) =>
        filters.chamber === "All" ||
        text(bill.chamber) === filters.chamber
      )
      .filter((bill) =>
        filters.year === "All" ||
        String(bill.year) === filters.year
      )
      .filter((bill) =>
        !filters.district ||
        (text(bill.chamber) + "|" + text(bill.matched_district)) ===
          filters.district
      )
      .map((bill) => text(bill.legislator_name))
      .sort((a, b) => a.localeCompare(b))
  );

  select.replaceChildren(new Option("All legislators", ""));

  options.forEach((name) => {
    select.add(new Option(name, name));
  });

  select.value = options.includes(current) ? current : "";
}


function populateDistricts() {
  const select = el("district-select");
  const current = select.value;
  const filters = getFilters();
  const districts = new Map();

  state.allBills.forEach((bill) => {
    const chamber = text(bill.chamber);
    const district = text(bill.matched_district);
    const year = String(bill.year);

    if (!["House", "Senate"].includes(chamber) || !district) return;

    // Respect the selected chamber and year.
    if (filters.chamber !== "All" && chamber !== filters.chamber) return;
    if (filters.year !== "All" && year !== filters.year) return;

    // If a representative is selected, limit choices to their district.
    if (
      filters.legislator &&
      text(bill.legislator_name) !== filters.legislator
    ) return;

    const value = chamber + "|" + district;
    districts.set(value, { chamber, district });
  });

  const sortedDistricts = [...districts.entries()].sort((a, b) => {
    const chamberOrder = a[1].chamber.localeCompare(b[1].chamber);

    return chamberOrder || a[1].district.localeCompare(
      b[1].district,
      undefined,
      { numeric: true }
    );
  });

  select.replaceChildren(new Option("All districts", ""));

  sortedDistricts.forEach(([value, item]) => {
    select.add(
      new Option(
        item.chamber + " · District " + item.district,
        value
      )
    );
  });

  // Keep the current selection only if it remains valid.
  select.value = sortedDistricts.some(([value]) => value === current)
    ? current
    : "";
}

function syncPrimaryFilters(changed) {
  const year = el("year-select").value;
  const chamberSelect = el("chamber-select");
  const legislatorSelect = el("legislator-select");
  const districtSelect = el("district-select");

  let legislator = legislatorSelect.value;
  let district = districtSelect.value;
  let chamber = chamberSelect.value;

  if (changed === "district" && district) {
    const [districtChamber] = district.split("|");
    chamberSelect.value = districtChamber;
    chamber = districtChamber;

    const matchingLegislator = state.allBills.some((bill) =>
      text(bill.legislator_name) === legislator &&
      text(bill.chamber) === chamber &&
      text(bill.matched_district) === district.split("|")[1] &&
      (year === "All" || String(bill.year) === year)
    );

    if (legislator && !matchingLegislator) {
      legislatorSelect.value = "";
    }
  }

  if (changed === "legislator" && legislator) {
    const personBills = state.allBills.filter((bill) =>
      text(bill.legislator_name) === legislator &&
      (year === "All" || String(bill.year) === year) &&
      (chamber === "All" || text(bill.chamber) === chamber) &&
      (!district ||
        (text(bill.chamber) + "|" + text(bill.matched_district)) === district)
    );

    const person = personBills[0];

    if (person) {
      chamberSelect.value = text(person.chamber);
      chamber = text(person.chamber);

      const personDistrict = text(person.matched_district);
      districtSelect.value = personDistrict
        ? chamber + "|" + personDistrict
        : "";

      district = districtSelect.value;
    }
  }

  if (changed === "chamber") {
    if (district && !district.startsWith(chamber + "|")) {
      districtSelect.value = "";
      district = "";
    }

    const matchingLegislator = state.allBills.some((bill) =>
      text(bill.legislator_name) === legislator &&
      text(bill.chamber) === chamber &&
      (year === "All" || String(bill.year) === year)
    );

    if (legislator && !matchingLegislator) {
      legislatorSelect.value = "";
    }
  }

  if (changed === "year") {
    const matchesYear = (bill) =>
      year === "All" || String(bill.year) === year;

    if (legislator && !state.allBills.some((bill) =>
      text(bill.legislator_name) === legislator &&
      matchesYear(bill) &&
      (chamber === "All" || text(bill.chamber) === chamber) &&
      (!district ||
        (text(bill.chamber) + "|" + text(bill.matched_district)) === district)
    )) {
      legislatorSelect.value = "";
      legislator = "";
    }

    if (district && !state.allBills.some((bill) =>
      (text(bill.chamber) + "|" + text(bill.matched_district)) === district &&
      matchesYear(bill)
    )) {
      districtSelect.value = "";
    }
  }

  populateDistricts();
  populateLegislators();

  // If a selected person has a district, keep that district selected.
  if (legislatorSelect.value && changed === "legislator") {
    const person = state.allBills.find((bill) =>
      text(bill.legislator_name) === legislatorSelect.value &&
      (year === "All" || String(bill.year) === year) &&
      text(bill.chamber) === chamberSelect.value
    );

    if (person && text(person.matched_district)) {
      const key = text(person.chamber) + "|" + text(person.matched_district);
      if ([...districtSelect.options].some((option) => option.value === key)) {
        districtSelect.value = key;
      }
    }
  }
}

function renderHeader(bills) {
  const filters = getFilters();
  const selected = filters.legislator;
  const memberRecord = selected
    ? bills.find((bill) => text(bill.legislator_name) === selected)
    : null;

  let title = "All legislators";
  let tag = "ALL MEMBERS";
  const details = [];

  if (selected) {
    title = selected;
    tag = memberRecord?.chamber === "Senate"
      ? "STATE SENATE"
      : memberRecord?.chamber === "House"
        ? "STATE HOUSE"
        : "LEGISLATOR";
  } else if (filters.district) {
    const [chamber, district] = filters.district.split("|");
    title = chamber + " · District " + district;
    tag = chamber === "Senate" ? "STATE SENATE" : "STATE HOUSE";
  } else if (filters.chamber !== "All") {
    title = filters.chamber === "Senate"
      ? "State Senate"
      : "State House";
    tag = filters.chamber === "Senate" ? "STATE SENATE" : "STATE HOUSE";
  }

  if (memberRecord?.matched_district) {
    details.push("District " + text(memberRecord.matched_district));
  }
  if (memberRecord?.matched_party) {
    details.push(text(memberRecord.matched_party));
  }
  if (filters.year !== "All") {
    details.push(filters.year + " session");
  }

  const photo = el("legislator-photo");
  if (selected && memberRecord) {
    const nameParts = selected.split(",");
    const lastName = text(nameParts[0]).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase();
    const firstName = text(nameParts[1]).trim().split(/\s+/)[0];
    const firstInitial = firstName ? firstName[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase() : "";
    const chamberPath = text(memberRecord.chamber).toLowerCase();
    if (lastName && firstInitial && ["house", "senate"].includes(chamberPath)) {
      photo.src = "https://le.utah.gov/images/legislator/" + chamberPath + "/" + lastName + firstInitial + ".jpg";
      photo.alt = "Photo of " + selected.replace(",", "");
      photo.hidden = false;
      photo.onerror = () => { photo.hidden = true; photo.removeAttribute("src"); };
    } else {
      photo.hidden = true;
      photo.removeAttribute("src");
    }
  } else {
    photo.hidden = true;
    photo.removeAttribute("src");
  }

  el("view-title").textContent = title;
  el("view-subtitle").textContent = details.length
    ? details.join(" · ")
    : selected
      ? "Legislator bill records in the selected view."
      : filters.district
        ? "Bill records for the selected district."
        : filters.chamber !== "All"
          ? "Bill records for this chamber."
          : "A look across Utah legislative bill records.";

  el("person-tag").textContent = tag;
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
  ["Passed", "Failed"].forEach((outcome) => {
    const card = el(outcome === "Passed" ? "stat-passed" : "stat-failed").closest(".stat-card");
    const active = el("outcome-select").value === outcome;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-pressed", String(active));
  });
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
  const colors = {
    Passed: "#1c756d",
    Failed: "#b9574d",
    Unverified: "#e5b85c"
  };

  const yearlyCounts = years.map((year) => {
    const yearBills = bills.filter((bill) => String(bill.year) === year);
    return {
      year,
      Passed: yearBills.filter((bill) => outcomeKind(bill) === "Passed").length,
      Failed: yearBills.filter((bill) => outcomeKind(bill) === "Failed").length,
      Unverified: yearBills.filter((bill) => outcomeKind(bill) === "Unverified").length
    };
  });

  const max = Math.max(
    ...yearlyCounts.map((item) => item.Passed + item.Failed + item.Unverified),
    1
  );

  const pad = { top: 24, right: 10, bottom: 34, left: 36 };
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
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = "#859399";
    ctx.fillText(numberFormat.format(value), pad.left - 8, y);
  }

  const slot = plotWidth / years.length;
  const barWidth = Math.min(42, slot * 0.48);

  yearlyCounts.forEach((item, i) => {
    const x = pad.left + slot * i + (slot - barWidth) / 2;
    let currentY = pad.top + plotHeight;
    const total = item.Passed + item.Failed + item.Unverified;

    ["Passed", "Failed", "Unverified"].forEach((outcome) => {
      const count = item[outcome];
      const segmentHeight = (count / max) * plotHeight;

      if (count > 0) {
        currentY -= segmentHeight;
        ctx.fillStyle = colors[outcome];
        ctx.fillRect(x, currentY, barWidth, segmentHeight);
      }
    });

    ctx.fillStyle = "#52656d";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "10px 'DM Mono', monospace";
    ctx.fillText(item.year, x + barWidth / 2, height - pad.bottom + 12);

    if (total > 0) {
      const totalHeight = (total / max) * plotHeight;
      const topY = pad.top + plotHeight - totalHeight;

      ctx.fillStyle = "#182e3b";
      ctx.font = "600 10px 'DM Sans', sans-serif";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        numberFormat.format(total),
        x + barWidth / 2,
        topY - 5
      );
    }
  });

  el("chart-total").textContent =
    numberFormat.format(bills.length) + " records";
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


const DISTRICTS_URL = "./data/utah_districts.geojson";

function selectedDistrictKey() {
  const filters = getFilters();
  if (filters.district) return filters.district;

  if (filters.legislator) {
    const person = state.allBills.find((bill) =>
      text(bill.legislator_name) === filters.legislator &&
      text(bill.chamber) &&
      text(bill.matched_district) &&
      ["House", "Senate"].includes(text(bill.chamber))
    );
    if (person) return text(person.chamber) + "|" + text(person.matched_district);
  }
  return "";
}

function districtStyle(feature) {
  const properties = feature.properties || {};
  const key = text(properties.district_key) ||
    (text(properties.chamber) + "|" + text(properties.district));
  const selectedKey = selectedDistrictKey();
  const chamber = text(properties.chamber);
  const chamberFilter = el("chamber-select").value;
  const isSelected = Boolean(selectedKey && key === selectedKey);
  const isDimmed = chamberFilter !== "All" && chamber !== chamberFilter;

  return {
    color: isSelected ? "#142b3b" : (chamber === "Senate" ? "#8b6b9b" : "#1c756d"),
    weight: isSelected ? 3 : 1,
    opacity: isDimmed ? 0.18 : 0.9,
    fillColor: isSelected ? "#e5b85c" : (chamber === "Senate" ? "#cdbbd8" : "#9ed4c3"),
    fillOpacity: isSelected ? 0.82 : (isDimmed ? 0.04 : 0.42)
  };
}

function updateDistrictMap() {
  if (!state.districtLayer) return;
  state.districtLayer.setStyle(districtStyle);

  const key = selectedDistrictKey();
  const label = el("map-selection-label");
  const status = el("map-status");

  if (key) {
    const [chamber, district] = key.split("|");
    label.textContent = chamber.toUpperCase() + " · DISTRICT " + district;
    status.textContent = "Highlighted " + chamber + " District " + district + ".";
  } else {
    label.textContent = el("chamber-select").value === "All"
      ? "ALL DISTRICTS"
      : el("chamber-select").value.toUpperCase() + " DISTRICTS";
    status.textContent = "Choose a district on the map or with the filters above.";
  }

  if (state.districtMap && key) {
    const feature = state.districtFeatures.find((item) => {
      const props = item.properties || {};
      return (text(props.district_key) ||
        (text(props.chamber) + "|" + text(props.district))) === key;
    });
    if (feature) {
      const bounds = L.geoJSON(feature).getBounds();
      if (bounds.isValid()) state.districtMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 9 });
    }
  }
}

async function initDistrictMap() {
  const mapContainer = el("district-map");
  if (!mapContainer) return;

  if (typeof L === "undefined") {
    mapContainer.innerHTML = '<p class="map-error">The map library could not load. Check your internet connection and refresh.</p>';
    el("map-status").textContent = "Map library unavailable.";
    return;
  }

  try {
    const response = await fetch(DISTRICTS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("District boundary request failed: " + response.status);
    const geojson = await response.json();
    if (!geojson || !Array.isArray(geojson.features)) {
      throw new Error("The district file is not a valid GeoJSON FeatureCollection.");
    }

    state.districtFeatures = geojson.features;
    state.districtMap = L.map("district-map", {
      scrollWheelZoom: false,
      zoomControl: true
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(state.districtMap);

    state.districtLayer = L.geoJSON(geojson, {
      style: districtStyle,
      onEachFeature(feature, layer) {
        const props = feature.properties || {};
        const chamber = text(props.chamber);
        const district = text(props.district);
        layer.bindTooltip(chamber + " · District " + district);
        layer.on("click", () => {
          const key = text(props.district_key) || (chamber + "|" + district);
          const districtSelect = el("district-select");

          // Clicking the already-selected district clears that selection.
          if (districtSelect.value === key) {
            districtSelect.value = "";
            populateDistricts();
            onPrimaryFilterChange("district");
            const allBounds = state.districtLayer.getBounds();
            if (allBounds.isValid()) {
              state.districtMap.fitBounds(allBounds, { padding: [12, 12] });
            }
            return;
          }

          if (![...districtSelect.options].some((option) => option.value === key)) {
            // Refresh options against the active year/chamber before selecting.
            el("year-select").value = "All";
            populateDistricts();
          }
          districtSelect.value = key;
          onPrimaryFilterChange("district");
          el("district-map").scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    }).addTo(state.districtMap);

    const bounds = state.districtLayer.getBounds();
    if (bounds.isValid()) state.districtMap.fitBounds(bounds, { padding: [12, 12] });
    updateDistrictMap();
    window.setTimeout(() => state.districtMap && state.districtMap.invalidateSize(), 100);
  } catch (error) {
    console.error("Could not load district map:", error);
    mapContainer.innerHTML = '<p class="map-error">Could not load district boundaries. Confirm data/utah_districts.geojson is committed and valid.</p>';
    el("map-status").textContent = "District boundaries could not be loaded.";
  }
}

function render() {
  const bills = getBaseBills();
  renderHeader(bills);
  renderStats(bills);
  renderChart(bills.filter((bill) => el("outcome-select").value === "All" || outcomeKind(bill) === el("outcome-select").value));
  renderTable();
  updateDistrictMap();
}

function onPrimaryFilterChange(changed) {
  syncPrimaryFilters(changed);
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
  el("district-select").value = "";
  // Rebuild both dependent dropdowns after clearing all primary filters.
  // Otherwise the district list can retain the single district from a map click.
  populateDistricts();
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
    populateDistricts();
    render();
    initDistrictMap();


    ["legislator-select", "chamber-select", "year-select"].forEach((id) => {
      el(id).addEventListener("change", () => {
        const changed = {
          "legislator-select": "legislator",
          "chamber-select": "chamber",
          "year-select": "year"
        }[id];

        onPrimaryFilterChange(changed);
      });
    });

    el("district-select").addEventListener("change", () => {
      onPrimaryFilterChange("district");
    });

    el("year-chart").addEventListener("click", (event) => {
      const canvas = el("year-chart");
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const years = ["2023", "2024", "2025", "2026"];
      const pad = { top: 24, right: 10, bottom: 34, left: 36 };
      const plotWidth = Math.max(260, rect.width) - pad.left - pad.right;
      const labelTop = Math.max(180, rect.height) - pad.bottom;

      // Only toggle when the user clicks the year labels beneath the bars.
      if (y < labelTop || y > labelTop + 24 || x < pad.left || x > rect.width - pad.right) return;
      const slot = plotWidth / years.length;
      const index = Math.floor((x - pad.left) / slot);
      const year = years[index];
      if (!year) return;

      const yearSelect = el("year-select");
      yearSelect.value = yearSelect.value === year ? "All" : year;
      onPrimaryFilterChange("year");
      el("bill-table-body").closest(".bills-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    el("reset-filters").addEventListener("click", resetFilters);
    el("stat-sponsored").closest(".stat-card").addEventListener("click", () => {
      el("bill-table-body").closest(".bills-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    ["Passed", "Failed"].forEach((outcome) => {
      const card = el(outcome === "Passed" ? "stat-passed" : "stat-failed").closest(".stat-card");
      card.classList.add("stat-card-interactive");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Filter bills to " + outcome.toLowerCase() + " outcomes. Activate again to clear.");
      const toggleOutcome = () => {
        const select = el("outcome-select");
        select.value = select.value === outcome ? "All" : outcome;
        state.page = 1;
        render();
        el("outcome-bars").scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
      card.addEventListener("click", toggleOutcome);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleOutcome();
        }
      });
    });
    el("prev-page").addEventListener("click", () => { state.page -= 1; renderTable(); });
    el("next-page").addEventListener("click", () => { state.page += 1; renderTable(); });
    window.addEventListener("resize", () => renderChart(getBaseBills()));
  } catch (error) {
    showLoadError(error);
  }
}

document.addEventListener("DOMContentLoaded", init);