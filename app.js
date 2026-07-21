/**
 * app.js
 * ตรรกะหลักของ EV Garage Finder: โหลดข้อมูล, ค้นหา/กรอง, และ render การ์ดผลลัพธ์
 */

(function () {
  "use strict";

  // ---------- State ----------
  let allGarages = [];
  let state = {
    query: "",
    province: "",
    district: "",
    evType: "",
    service: "",
    activeChip: "",
    sort: "name-asc",
  };

  // ---------- DOM refs ----------
  const $searchInput = document.getElementById("search-input");
  const $provinceSelect = document.getElementById("filter-province");
  const $districtSelect = document.getElementById("filter-district");
  const $evTypeSelect = document.getElementById("filter-evtype");
  const $serviceSelect = document.getElementById("filter-service");
  const $sortSelect = document.getElementById("sort-select");
  const $quickChips = document.getElementById("quick-chips");
  const $resultsGrid = document.getElementById("results-grid");
  const $resultsCount = document.getElementById("results-count");
  const $headerTotal = document.getElementById("header-total-count");
  const $btnReset = document.getElementById("btn-reset");

  // QR modal refs
  const $qrOverlay = document.getElementById("qr-overlay");
  const $btnCloseQr = document.getElementById("btn-close-qr");
  const $qrDesc = document.getElementById("qr-desc");
  const $qrGarageName = document.getElementById("qr-garage-name");
  const $qrTabs = document.getElementById("qr-tabs");
  const $qrCodeBox = document.getElementById("qr-code-box");
  const $qrUrl = document.getElementById("qr-url");
  const $btnDownloadQr = document.getElementById("btn-download-qr");

  // Upload panel refs
  const $btnOpenUpload = document.getElementById("btn-open-upload");
  const $btnCloseUpload = document.getElementById("btn-close-upload");
  const $uploadOverlay = document.getElementById("upload-overlay");
  const $dropzone = document.getElementById("dropzone");
  const $fileInput = document.getElementById("file-input");
  const $uploadStatus = document.getElementById("upload-status");
  const $btnResetData = document.getElementById("btn-reset-data");
  const $btnAdminLogout = document.getElementById("btn-admin-logout");
  const $btnDownloadTemplate = document.getElementById("btn-download-template");
  const $apiKeyInput = document.getElementById("apps-script-key-input");

  // Admin login refs
  const $adminLoginOverlay = document.getElementById("admin-login-overlay");
  const $btnCloseLogin = document.getElementById("btn-close-login");
  const $adminLoginForm = document.getElementById("admin-login-form");
  const $adminUsernameInput = document.getElementById("admin-username");
  const $adminPasswordInput = document.getElementById("admin-password");
  const $loginError = document.getElementById("login-error");

  const ADMIN_SESSION_KEY = "evGarageFinderAdminSession";
  const API_KEY_SESSION_KEY = "evGarageFinderApiKey";

  // ---------------------------------------------------------------
  // ADMIN CREDENTIALS — เปลี่ยนค่านี้ก่อน deploy จริง
  // หมายเหตุด้านความปลอดภัย: เว็บนี้เป็น static site ไม่มี backend
  // การกันด้วย username/password ฝั่ง JavaScript นี้ป้องกันได้แค่ผู้ใช้ทั่วไปที่ไม่ได้
  // ตั้งใจแกะโค้ด (deterrent) เท่านั้น ไม่ใช่การรักษาความปลอดภัยที่แท้จริง
  // เพราะไฟล์นี้เปิดดูได้จาก "View Page Source" ในเบราว์เซอร์ ถ้าต้องการ
  // ความปลอดภัยจริงจังต้องมีระบบ login ฝั่งเซิร์ฟเวอร์ (backend/auth service)
  // ---------------------------------------------------------------
  const ADMIN_USERNAME = "admin";
  const ADMIN_PASSCODE = "pk-admin-2026";

  // ---------------------------------------------------------------
  // GOOGLE SHEET BACKEND (Google Apps Script Web App)
  // แทนที่การอ่าน/เขียน data/database.json บน GitHub ทั้งหมด — ตอนนี้ฐานข้อมูล
  // จริง (source of truth) คือ Google Sheet ที่ผูกกับ Apps Script โปรเจกต์
  // ใน apps-script/Code.gs (วิธี deploy ดูคอมเมนต์บนสุดของไฟล์นั้น)
  //
  // - อ่านข้อมูล (โหลดหน้าเว็บ): เรียก GET ไปที่ APPS_SCRIPT_URL ตรงๆ ไม่ต้องมี
  //   apiKey เพราะ endpoint นี้เป็นสาธารณะ (read-only)
  // - เขียนข้อมูล (อัปโหลด/รีเซ็ต): เรียก POST ไปที่ APPS_SCRIPT_URL พร้อมแนบ
  //   apiKey ที่ต้องตรงกับ Script Property "API_KEY" ที่ตั้งไว้ฝั่ง Apps Script
  //   เท่านั้นถึงจะเขียนได้ — apiKey นี้ "ไม่เคยถูกฝัง" ไว้ในไฟล์นี้ (ไฟล์นี้เป็น
  // 	public repo) แต่ให้แอดมินกรอกเองทุกครั้งในหน้าจัดการข้อมูล แล้วเก็บไว้ใน
  //   sessionStorage ของเบราว์เซอร์ชั่วคราวเท่านั้น (หายเมื่อปิดแท็บ/logout)
  // - ข้อดีเทียบกับวิธี commit ขึ้น GitHub โดยตรง: apiKey นี้ให้สิทธิ์แค่เขียน
  //   ชีตข้อมูลอู่ชีตเดียวเท่านั้น ไม่ใช่ credential ที่เข้าถึง repo/บัญชีทั้งหมด
  //   ต่อให้หลุดไปความเสียหายก็จำกัดวงแคบกว่ามาก และสามารถเปลี่ยน API_KEY
  //   ใหม่ได้ทันทีจาก Apps Script Script Properties โดยไม่กระทบส่วนอื่น
  // ---------------------------------------------------------------
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzUlQkPY8Cvon3a1i436IjzBbE7fZMk3G7Q_1Jg6Ci7jgKzhyR3JRgyBQ8fxkeDc2Of/exec";

  // Thai (and English) header → internal field map. Matched after trimming.
  const HEADER_MAP = {
    "ลำดับ": "id",
    "จังหวัด": "province",
    "อำเภอ/เขต": "district",
    "อำเภอ": "district",
    "ชื่ออู่": "name",
    "ประเภทรถ EV": "evTypes",
    "งานที่รับซ่อม": "services",
    "ผู้ติดต่อ": "contact",
    "โทรศัพท์": "phone",
    "Line": "line",
    "QR Code Line": "lineQr",
    "Facebook": "facebook",
    "Google Maps": "googleMaps",
    "วัน-เวลาทำการ": "hours",
    "หมายเหตุ": "notes",
  };
  const MULTI_VALUE_FIELDS = new Set(["evTypes", "services"]);

  // ---------- Icons (inline SVG, stroke-based) ----------
  const icon = {
    pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    user: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    phone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    line: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    facebook: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    map: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z"/><path d="M8 2v16M16 6v16"/></svg>',
    qr: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z"/></svg>',
    bolt: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
  };

  // ---------- Utilities ----------
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "th")
    );
  }

  function normalizePhoneForTel(phone) {
    return (phone || "").replace(/[^0-9+]/g, "");
  }

  // Excel/Sheets often strips a leading "0" when a phone number is stored as a
  // number instead of text. If we see an 8-9 digit number with no leading 0
  // and no country code, restore it — the same fix used on the LINE OA side.
  function normalizePhoneDisplay(raw) {
    if (raw === null || raw === undefined) return "";
    let str = String(raw).trim();
    if (!str) return "";
    const digitsOnly = str.replace(/[^0-9]/g, "");
    if (/^[0-9]{8,9}$/.test(digitsOnly) && !str.startsWith("0") && !str.startsWith("+")) {
      str = "0" + digitsOnly;
    }
    return str;
  }

  function splitMultiValue(raw) {
    if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
    if (raw === null || raw === undefined) return [];
    return String(raw)
      .split(/[,，、\/]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function normalizeLineUrl(line) {
    if (!line) return "";
    if (line.startsWith("http")) return line;
    const handle = line.replace(/^@/, "");
    return "https://line.me/R/ti/p/@" + handle;
  }

  // ---------- Data loading ----------
  // ทุกเครื่อง/เบราว์เซอร์อ่านข้อมูลจาก Google Sheet ผ่าน Apps Script Web App
  // เสมอ (ไม่มี localStorage override, ไม่มีการเขียนขึ้น GitHub อีกต่อไป)
  // พร้อม cache-busting query string เพื่อบังคับให้ได้ข้อมูลล่าสุดหลังแอดมิน
  // อัปเดตเสร็จ (Apps Script เขียนกลับ Sheet ได้ทันที ไม่ต้องรอ rebuild เหมือน
  // GitHub Pages)
  async function loadBaseData() {
    try {
      if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("YOUR_DEPLOYMENT_ID") !== -1) {
        throw new Error("ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ในไฟล์ js/app.js");
      }
      const res = await fetch(APPS_SCRIPT_URL + "?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed: " + res.status);
      const json = await res.json();
      if (!Array.isArray(json) || json.length === 0) throw new Error("empty response");
      return json;
    } catch (err) {
      // Apps Script ยังไม่ได้ตั้งค่า / ไม่มีอินเทอร์เน็ต / เปิดผ่าน file:// -> ใช้ข้อมูลสำรองใน data.js
      console.warn("[EV Garage Finder] ใช้ข้อมูลสำรองจาก js/data.js เนื่องจาก:", err.message);
      return window.EV_GARAGE_FALLBACK_DATA || [];
    }
  }

  async function loadData() {
    return loadBaseData();
  }

  // ---------- API key (session-only, never written to any file) ----------
  function getApiKey() {
    try {
      return sessionStorage.getItem(API_KEY_SESSION_KEY) || "";
    } catch {
      return "";
    }
  }

  function setApiKey(key) {
    try {
      if (key) sessionStorage.setItem(API_KEY_SESSION_KEY, key);
      else sessionStorage.removeItem(API_KEY_SESSION_KEY);
    } catch {
      /* sessionStorage ไม่พร้อมใช้งาน (เช่น โหมด private ที่บล็อกไว้) — ข้ามไป */
    }
  }

  // ---------- Write to Google Sheet via Apps Script Web App ----------
  // ส่งเป็น Content-Type: text/plain (ไม่ใช่ application/json) โดยตั้งใจ —
  // Apps Script Web App จัดการ CORS preflight (OPTIONS request) ของ
  // application/json ได้ไม่ดี การส่งเป็น text/plain ทำให้ browser มองเป็น
  // "simple request" ไม่ต้อง preflight ก่อน ส่วน Apps Script ฝั่งรับยังอ่าน
  // e.postData.contents แล้ว JSON.parse เองได้ตามปกติ ไม่ต่างกัน
  async function postDatabaseToAppsScript(garages, mode, commitMessage) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("ยังไม่ได้กรอก API Key ในช่องด้านบนของหน้าจัดการข้อมูล");
    }
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("YOUR_DEPLOYMENT_ID") !== -1) {
      throw new Error("ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ในไฟล์ js/app.js (ดูวิธี deploy ที่ apps-script/Code.gs)");
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ apiKey, mode, garages, note: commitMessage }),
    });

    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${res.status})`);
    }

    if (!res.ok || !body.ok) {
      throw new Error(body.error || `บันทึกไม่สำเร็จ (HTTP ${res.status})`);
    }

    return body;
  }

  // ---------- Populate filter controls ----------
  function resetSelectOptions($select) {
    const placeholder = $select.querySelector("option[value='']");
    $select.innerHTML = "";
    if (placeholder) $select.appendChild(placeholder);
  }

  function populateFilters(garages) {
    resetSelectOptions($provinceSelect);
    resetSelectOptions($districtSelect);
    resetSelectOptions($evTypeSelect);
    resetSelectOptions($serviceSelect);

    const provinces = uniqueSorted(garages.map((g) => g.province));
    const districts = uniqueSorted(garages.map((g) => g.district));
    const evTypes = uniqueSorted(garages.flatMap((g) => g.evTypes || []));
    const services = uniqueSorted(garages.flatMap((g) => g.services || []));

    provinces.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      $provinceSelect.appendChild(opt);
    });

    districts.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      $districtSelect.appendChild(opt);
    });

    evTypes.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      $evTypeSelect.appendChild(opt);
    });

    services.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      $serviceSelect.appendChild(opt);
    });

    // Quick chips: top services (max 6) as fast filters
    const chipServices = services.slice(0, 6);
    $quickChips.innerHTML = chipServices
      .map((s) => `<button type="button" class="chip" data-service="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
      .join("");

    $quickChips.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const val = chip.getAttribute("data-service");
        if (state.activeChip === val) {
          state.activeChip = "";
          state.service = "";
          chip.classList.remove("active");
        } else {
          state.activeChip = val;
          state.service = val;
          $quickChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
        }
        $serviceSelect.value = state.service;
        render();
      });
    });
  }

  // ---------- Filtering + sorting ----------
  function getFilteredGarages() {
    const q = state.query.trim().toLowerCase();

    let list = allGarages.filter((g) => {
      if (state.province && g.province !== state.province) return false;
      if (state.district && g.district !== state.district) return false;
      if (state.evType && !(g.evTypes || []).includes(state.evType)) return false;
      if (state.service && !(g.services || []).includes(state.service)) return false;

      if (q) {
        const haystack = [
          g.name,
          g.province,
          g.district,
          ...(g.evTypes || []),
          ...(g.services || []),
          g.contact,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (state.sort === "province-asc") {
        return (a.province || "").localeCompare(b.province || "", "th") ||
          (a.name || "").localeCompare(b.name || "", "th");
      }
      return (a.name || "").localeCompare(b.name || "", "th");
    });

    return list;
  }

  // ---------- Rendering ----------
  function renderCard(g) {
    const evChips = (g.evTypes || [])
      .map((t) => `<span class="tag ev-type">${escapeHtml(t)}</span>`)
      .join("");
    const serviceChips = (g.services || [])
      .map((s) => `<span class="tag service">${escapeHtml(s)}</span>`)
      .join("");

    const telHref = g.phone ? `tel:${normalizePhoneForTel(g.phone)}` : "";
    const lineHref = normalizeLineUrl(g.line);

    return `
      <article class="garage-card">
        <div class="card-top">
          <div>
            <h3 class="card-name">${escapeHtml(g.name)}</h3>
            <div class="card-location">${icon.pin} ${escapeHtml(g.district)}, ${escapeHtml(g.province)}</div>
          </div>
          <span class="status-badge">${escapeHtml(g.id || "")}</span>
        </div>

        <div>
          <p class="card-section-label">ประเภทรถ EV</p>
          <div class="tag-group">${evChips || '<span class="tag">ไม่ระบุ</span>'}</div>
        </div>

        <div>
          <p class="card-section-label">งานที่รับซ่อม</p>
          <div class="tag-group">${serviceChips || '<span class="tag">ไม่ระบุ</span>'}</div>
        </div>

        <div class="card-hours">${icon.clock} ${escapeHtml(g.hours || "ไม่ระบุเวลาทำการ")}</div>

        ${g.contact ? `<div class="card-contact">${icon.user} ผู้ติดต่อ: ${escapeHtml(g.contact)}${g.phone ? " · " + escapeHtml(g.phone) : ""}</div>` : ""}

        ${g.notes ? `<p class="card-notes">${escapeHtml(g.notes)}</p>` : ""}

        <div class="card-links">
          <a class="link-btn ${telHref ? "" : "disabled"}" href="${telHref}" aria-label="โทรหา ${escapeHtml(g.name)}">${icon.phone} โทร</a>
          <a class="link-btn ${g.line ? "" : "disabled"}" href="${lineHref}" target="_blank" rel="noopener" aria-label="แชท LINE กับ ${escapeHtml(g.name)}">${icon.line} LINE</a>
          <a class="link-btn ${g.facebook ? "" : "disabled"}" href="${g.facebook || "#"}" target="_blank" rel="noopener" aria-label="เปิด Facebook ของ ${escapeHtml(g.name)}">${icon.facebook} FB</a>
          <a class="link-btn primary ${g.googleMaps ? "" : "disabled"}" href="${g.googleMaps || "#"}" target="_blank" rel="noopener" aria-label="เปิดแผนที่ ${escapeHtml(g.name)}">${icon.map} แผนที่</a>
        </div>
        <button type="button" class="link-btn qr-btn" data-qr-id="${escapeHtml(g.id)}" aria-label="แสดง QR Code ของ ${escapeHtml(g.name)}">${icon.qr} แสดง QR Code สำหรับติดหน้าร้าน</button>
      </article>
    `;
  }

  function renderEmptyState() {
    return `
      <div class="empty-state">
        ${icon.bolt}
        <h3>ไม่พบอู่ที่ตรงกับเงื่อนไข</h3>
        <p>ลองปรับคำค้นหาหรือเงื่อนไขตัวกรองดู หรือเริ่มใหม่ทั้งหมด</p>
        <button type="button" id="empty-reset-btn">ล้างตัวกรองทั้งหมด</button>
      </div>
    `;
  }

  function render() {
    const filtered = getFilteredGarages();
    $resultsCount.textContent = filtered.length;

    if (filtered.length === 0) {
      $resultsGrid.innerHTML = renderEmptyState();
      const btn = document.getElementById("empty-reset-btn");
      if (btn) btn.addEventListener("click", resetAll);
      return;
    }

    $resultsGrid.innerHTML = filtered.map(renderCard).join("");
  }

  // ---------- QR code (for printing / posting at the garage) ----------
  let currentQrGarage = null;
  let currentQrType = "maps";

  function buildMapsQrTarget(g) {
    if (g.googleMaps) return g.googleMaps;
    const query = [g.name, g.district, g.province].filter(Boolean).join(" ");
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  // Returns { mode: "image", src } when the admin uploaded a real LINE QR
  // picture (preferred — it's their actual official LINE QR), or
  // { mode: "generated", url } when we should generate one from the LINE
  // handle/link instead, or null if the garage has no LINE info at all.
  function buildLineQrTarget(g) {
    if (g.lineQr) return { mode: "image", src: g.lineQr };
    if (g.line) return { mode: "generated", url: normalizeLineUrl(g.line) };
    return null;
  }

  function safeFileName(str) {
    return (str || "garage")
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60);
  }

  function renderGeneratedQr(text, filename) {
    $qrCodeBox.innerHTML = "";
    $qrCodeBox.dataset.filename = filename;
    $qrCodeBox.dataset.mode = "generated";
    $qrUrl.textContent = text;

    // eslint-disable-next-line no-new
    new QRCode($qrCodeBox, {
      text: text,
      width: 220,
      height: 220,
      colorDark: "#0a0f1c",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  function renderImageQr(src, filename) {
    $qrCodeBox.innerHTML = `<img src="${escapeHtml(src)}" alt="LINE QR Code" crossorigin="anonymous">`;
    $qrCodeBox.dataset.filename = filename;
    $qrCodeBox.dataset.mode = "image";
    $qrUrl.textContent = src;
  }

  function renderQrTab(type) {
    if (!currentQrGarage) return;
    currentQrType = type;

    $qrTabs.querySelectorAll(".qr-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-qr-type") === type);
    });

    const filenameBase = "QR-" + safeFileName(currentQrGarage.name);

    if (type === "maps") {
      $qrDesc.textContent = "พิมพ์แล้วนำไปติดที่หน้าร้าน — ลูกค้าสแกนแล้วเปิดแผนที่ไปยังอู่นี้ได้ทันที";
      renderGeneratedQr(buildMapsQrTarget(currentQrGarage), filenameBase + "-maps.png");
      return;
    }

    // type === "line"
    $qrDesc.textContent = "พิมพ์แล้วนำไปติดที่หน้าร้าน — ลูกค้าสแกนแล้วเพิ่มเพื่อน LINE ของอู่นี้ได้ทันที";
    const lineTarget = buildLineQrTarget(currentQrGarage);
    if (!lineTarget) {
      $qrCodeBox.innerHTML = `<p class="status-err" style="margin:0; max-width:200px;">อู่นี้ยังไม่มีข้อมูล LINE — เพิ่มช่อง "Line" หรือ "QR Code Line" ในฐานข้อมูลก่อน</p>`;
      $qrCodeBox.dataset.filename = "";
      $qrCodeBox.dataset.mode = "";
      $qrUrl.textContent = "";
      return;
    }
    if (lineTarget.mode === "image") {
      renderImageQr(lineTarget.src, filenameBase + "-line.png");
    } else {
      renderGeneratedQr(lineTarget.url, filenameBase + "-line.png");
    }
  }

  function openQrModal(garage) {
    currentQrGarage = garage;
    $qrGarageName.textContent = garage.name;

    const hasLine = !!buildLineQrTarget(garage);
    const $lineTab = $qrTabs.querySelector('[data-qr-type="line"]');
    $lineTab.hidden = !hasLine;

    if (typeof QRCode === "undefined") {
      $qrCodeBox.innerHTML = `<p class="status-err" style="margin:0;">ตัวสร้าง QR Code ยังโหลดไม่เสร็จ (ต้องมีอินเทอร์เน็ตตอนโหลดหน้าเว็บครั้งแรก) ลองรอสักครู่แล้วกดใหม่</p>`;
      $qrUrl.textContent = "";
      $qrOverlay.hidden = false;
      return;
    }

    renderQrTab("maps");
    $qrOverlay.hidden = false;
  }

  function closeQrModal() {
    $qrOverlay.hidden = true;
  }

  function downloadQrCode() {
    const mode = $qrCodeBox.dataset.mode;
    const filename = $qrCodeBox.dataset.filename || "garage-qr.png";

    if (mode === "generated") {
      const canvas = $qrCodeBox.querySelector("canvas");
      const img = $qrCodeBox.querySelector("img");
      const dataUrl = canvas ? canvas.toDataURL("image/png") : img ? img.src : null;
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (mode === "image") {
      // Real uploaded LINE QR image — likely hosted elsewhere, so a direct
      // download link may just open it in a new tab depending on CORS.
      // That's an acceptable fallback: the user can save it manually.
      const img = $qrCodeBox.querySelector("img");
      if (!img) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 220;
        canvas.height = img.naturalHeight || 220;
        canvas.getContext("2d").drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        // Cross-origin image without CORS headers taints the canvas — fall
        // back to just opening the image so the user can save it manually.
        window.open(img.src, "_blank", "noopener");
      }
    }
  }

  function bindQrEvents() {
    $resultsGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".qr-btn");
      if (!btn) return;
      const id = btn.getAttribute("data-qr-id");
      const garage = allGarages.find((g) => g.id === id);
      if (garage) openQrModal(garage);
    });

    $qrTabs.querySelectorAll(".qr-tab").forEach((btn) => {
      btn.addEventListener("click", () => renderQrTab(btn.getAttribute("data-qr-type")));
    });

    $btnCloseQr.addEventListener("click", closeQrModal);
    $qrOverlay.addEventListener("click", (e) => {
      if (e.target === $qrOverlay) closeQrModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$qrOverlay.hidden) closeQrModal();
    });
    $btnDownloadQr.addEventListener("click", downloadQrCode);
  }

  // ---------- Admin authentication (client-side gate) ----------
  function isAdminAuthed() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  }

  function openLoginPanel() {
    $loginError.textContent = "";
    $adminUsernameInput.value = "";
    $adminPasswordInput.value = "";
    $adminLoginOverlay.hidden = false;
    setTimeout(() => $adminUsernameInput.focus(), 50);
  }

  function closeLoginPanel() {
    $adminLoginOverlay.hidden = true;
  }

  function requestUploadAccess() {
    if (isAdminAuthed()) {
      openUploadPanel();
    } else {
      openLoginPanel();
    }
  }

  function handleLoginSubmit(e) {
    e.preventDefault();
    const usernameOk = $adminUsernameInput.value.trim() === ADMIN_USERNAME;
    const passwordOk = $adminPasswordInput.value === ADMIN_PASSCODE;

    if (usernameOk && passwordOk) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      closeLoginPanel();
      openUploadPanel();
    } else {
      $loginError.textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
      $adminPasswordInput.value = "";
      $adminUsernameInput.focus();
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setApiKey("");
    if ($apiKeyInput) $apiKeyInput.value = "";
    closeUploadPanel();
  }

  // ---------- Excel/CSV upload ----------
  function downloadTemplate() {
    if (typeof XLSX === "undefined") {
      $uploadStatus.innerHTML = `<p class="status-err">ตัวสร้างไฟล์ Excel ยังโหลดไม่เสร็จ (ต้องมีอินเทอร์เน็ตตอนโหลดหน้าเว็บครั้งแรก) ลองรอสักครู่แล้วกดใหม่</p>`;
      return;
    }
    const headers = ["ลำดับ", "จังหวัด", "อำเภอ/เขต", "ชื่ออู่", "ประเภทรถ EV",
      "งานที่รับซ่อม", "ผู้ติดต่อ", "โทรศัพท์", "Line", "QR Code Line", "Facebook",
      "Google Maps", "วัน-เวลาทำการ", "หมายเหตุ"];
    const legend = ["คำแนะนำ: กรอกข้อมูล 1 แถว = 1 อู่ / ช่อง 'ประเภทรถ EV' และ 'งานที่รับซ่อม' คั่นหลายค่าด้วยเครื่องหมายจุลภาค (,) เช่น BYD, NETA, MG / ช่อง 'โทรศัพท์' ควรตั้งค่ารูปแบบเป็นข้อความ (Text) เพื่อไม่ให้เลข 0 นำหน้าหาย / ช่อง 'QR Code Line' ใส่ลิงก์รูปภาพ QR Code LINE จริงของร้าน (ถ้ามี) — ถ้าเว้นว่าง ระบบจะสร้าง QR จากช่อง Line ให้อัตโนมัติ / ลบแถวตัวอย่าง (แถวที่ 3) ก่อนอัปโหลดจริงได้ถ้าไม่ต้องการ"];
    const example = ["EV-015", "นครราชสีมา", "โชคชัย", "ชื่ออู่ตัวอย่าง",
      "BYD, NETA", "แบตเตอรี่แรงดันสูง (HV Battery), ตรวจเช็คทั่วไป (PM)",
      "คุณสมชาย", "081-234-5678", "@ตัวอย่างline", "https://example.com/line-qr.png",
      "https://facebook.com/example", "https://maps.google.com/?q=example",
      "จันทร์-เสาร์ 08:30-18:00", "ใส่หรือปล่อยว่างก็ได้"];

    const ws = XLSX.utils.aoa_to_sheet([legend, headers, example]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    ws["!cols"] = [8, 14, 14, 22, 20, 34, 14, 14, 16, 26, 26, 30, 20, 26].map((w) => ({ wch: w }));

    const phoneColIdx = headers.indexOf("โทรศัพท์");
    const cellRef = XLSX.utils.encode_cell({ r: 2, c: phoneColIdx });
    if (ws[cellRef]) ws[cellRef].z = "@";

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "อู่ซ่อม EV");
    XLSX.writeFile(wb, "garage_template.xlsx");
  }

  function openUploadPanel() {
    $uploadOverlay.hidden = false;
    $uploadStatus.innerHTML = "";
    if ($apiKeyInput) $apiKeyInput.value = getApiKey();
  }

  function closeUploadPanel() {
    $uploadOverlay.hidden = true;
    $fileInput.value = "";
  }

  function mapRowToGarage(row, index) {
    const record = {};
    Object.keys(row).forEach((rawKey) => {
      const key = HEADER_MAP[String(rawKey).trim()];
      if (!key) return;
      const value = row[rawKey];
      if (key === "phone") {
        record.phone = normalizePhoneDisplay(value);
      } else if (MULTI_VALUE_FIELDS.has(key)) {
        record[key] = splitMultiValue(value);
      } else {
        record[key] = value === null || value === undefined ? "" : String(value).trim();
      }
    });

    if (!record.name || !record.province) return { record: null, error: `แถวที่ ${index}: ไม่มี "ชื่ออู่" หรือ "จังหวัด" — ข้ามแถวนี้` };

    if (!record.id) record.id = "UP-" + Date.now().toString(36) + "-" + index;
    record.district = record.district || "";
    record.evTypes = record.evTypes || [];
    record.services = record.services || [];
    record.contact = record.contact || "";
    record.phone = record.phone || "";
    record.line = record.line || "";
    record.lineQr = record.lineQr || "";
    record.facebook = record.facebook || "";
    record.googleMaps = record.googleMaps || "";
    record.hours = record.hours || "";
    record.notes = record.notes || "";

    return { record, error: null };
  }

  function mergeGarages(existing, incoming, mode) {
    if (mode === "replace") return incoming;
    const byId = new Map(existing.map((g) => [g.id, g]));
    incoming.forEach((g) => byId.set(g.id, g));
    return Array.from(byId.values());
  }

  function renderUploadStatus({ addedCount, errors, committed, commitError }) {
    const parts = [];
    if (commitError) {
      parts.push(`<p class="status-err">บันทึกขึ้น Google Sheet ไม่สำเร็จ: ${escapeHtml(commitError)}</p>`);
      parts.push(`<p class="status-note">ข้อมูลในหน้านี้ยังไม่ถูกเปลี่ยน — ลองตรวจสอบ API Key แล้วอัปโหลดไฟล์เดิมซ้ำอีกครั้ง</p>`);
      return void ($uploadStatus.innerHTML = parts.join(""));
    }
    if (addedCount > 0) {
      parts.push(
        `<p class="status-ok">✓ นำเข้าข้อมูลสำเร็จ ${addedCount} รายการ${committed ? " และบันทึกขึ้น Google Sheet แล้ว" : ""}</p>`
      );
      if (committed) {
        parts.push(`<p class="status-note">ทุกคนที่เข้าเว็บจะเห็นข้อมูลใหม่ทันทีในการโหลดครั้งถัดไป</p>`);
      }
    }
    if (errors.length > 0) {
      parts.push(`<p class="status-err">พบปัญหา ${errors.length} แถว (ข้ามแถวเหล่านี้):</p>`);
      parts.push("<ul>" + errors.slice(0, 10).map((e) => `<li>${escapeHtml(e)}</li>`).join("") + "</ul>");
    }
    if (addedCount === 0 && errors.length === 0) {
      parts.push(`<p class="status-err">ไม่พบข้อมูลที่อ่านได้ในไฟล์นี้ ตรวจสอบว่าหัวคอลัมน์ตรงกับ Template หรือไม่</p>`);
    }
    $uploadStatus.innerHTML = parts.join("");
  }

  // Converts a worksheet into row-objects, auto-detecting which row is the
  // real header row. This matters because the downloadable Template has an
  // instructions/legend row above the actual header row — if we naively
  // treated row 1 as headers (like sheet_to_json does by default), every
  // column would be misread and every data row would fail to match.
  function stripBom(v) {
    if (typeof v !== "string") return v;
    return v.replace(/^\uFEFF/, "").trim();
  }

  function sheetToRowObjects(sheet) {
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: false });
    const knownHeaders = Object.keys(HEADER_MAP);

    let headerRowIndex = -1;
    let bestScore = 0;
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const cells = aoa[i].map(stripBom);
      const score = cells.filter((c) => knownHeaders.includes(c)).length;
      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = i;
      }
    }
    // Require at least 2 recognizable headers before trusting a row as the header row.
    if (bestScore < 2) headerRowIndex = 0;

    const headerRow = aoa[headerRowIndex].map(stripBom);
    const dataRows = aoa.slice(headerRowIndex + 1);

    return dataRows
      .filter((r) => r.some((c) => String(c).trim() !== ""))
      .map((r) => {
        const obj = {};
        headerRow.forEach((h, colIdx) => {
          if (!h) return;
          obj[h] = stripBom(r[colIdx] !== undefined ? r[colIdx] : "");
        });
        return obj;
      });
  }

  async function handleWorkbookRows(rows) {
    const errors = [];
    const records = [];
    rows.forEach((row, i) => {
      const { record, error } = mapRowToGarage(row, i + 1);
      if (error) errors.push(error);
      if (record) records.push(record);
    });

    if (records.length === 0) {
      renderUploadStatus({ addedCount: 0, errors });
      return;
    }

    const mode = document.querySelector('input[name="upload-mode"]:checked').value;
    const merged = mergeGarages(allGarages, records, mode);

    $uploadStatus.innerHTML = `<p>กำลังบันทึกขึ้น Google Sheet...</p>`;

    try {
      // ผสาน (merge) ฝั่งเว็บเสร็จแล้ว จึงส่งเป็น "replace" ทั้งชุดไปที่ Apps
      // Script เพื่อเขียนทับชีตให้ตรงกับผลลัพธ์ที่เห็นในหน้าเว็บเป๊ะๆ
      await postDatabaseToAppsScript(
        merged,
        "replace",
        `อัปเดตฐานข้อมูลอู่ผ่านหน้าเว็บ: ${records.length} รายการ (โหมด ${mode})`
      );
      allGarages = merged;
      $headerTotal.textContent = allGarages.length + " รายการในฐานข้อมูล";
      populateFilters(allGarages);
      render();
      renderUploadStatus({ addedCount: records.length, errors, committed: true });
    } catch (err) {
      renderUploadStatus({ addedCount: 0, errors: [], commitError: err.message });
    }
  }

  function parseFile(file) {
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();

    reader.onerror = () => {
      $uploadStatus.innerHTML = `<p class="status-err">อ่านไฟล์ไม่สำเร็จ ลองไฟล์อื่นหรือบันทึกเป็น .xlsx ใหม่</p>`;
    };

    reader.onload = (e) => {
      try {
        if (typeof XLSX === "undefined") {
          $uploadStatus.innerHTML = `<p class="status-err">ไม่สามารถโหลดตัวอ่านไฟล์ Excel ได้ (ต้องเชื่อมต่ออินเทอร์เน็ตครั้งแรกเพื่อโหลดไลบรารี) ลองใหม่อีกครั้ง</p>`;
          return;
        }
        const data = isCsv ? e.target.result : new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: isCsv ? "string" : "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = sheetToRowObjects(sheet);
        handleWorkbookRows(rows);
      } catch (err) {
        console.error(err);
        $uploadStatus.innerHTML = `<p class="status-err">อ่านไฟล์ไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
      }
    };

    if (isCsv) reader.readAsText(file, "utf-8");
    else reader.readAsArrayBuffer(file);
  }

  function handleFileSelection(file) {
    if (!file) return;
    $uploadStatus.innerHTML = `<p>กำลังอ่านไฟล์ "${escapeHtml(file.name)}"...</p>`;
    parseFile(file);
  }

  function resetToDefaultData() {
    const confirmed = window.confirm(
      "ยืนยันรีเซ็ตฐานข้อมูลจริงบน Google Sheet กลับเป็นชุดข้อมูลเริ่มต้น?\n" +
        "การกระทำนี้จะเขียนทับชีต \"Garages\" บนเซิร์ฟเวอร์จริง และทุกคนจะเห็นการเปลี่ยนแปลงนี้"
    );
    if (!confirmed) return;

    const fallback = window.EV_GARAGE_FALLBACK_DATA || [];
    $uploadStatus.innerHTML = `<p>กำลังรีเซ็ตข้อมูลบน Google Sheet...</p>`;

    postDatabaseToAppsScript(fallback, "replace", "รีเซ็ตฐานข้อมูลกลับเป็นค่าเริ่มต้นผ่านหน้าเว็บ")
      .then(() => {
        allGarages = fallback;
        $headerTotal.textContent = allGarages.length + " รายการในฐานข้อมูล";
        populateFilters(allGarages);
        resetAll();
        $uploadStatus.innerHTML = `<p class="status-ok">✓ รีเซ็ตกลับเป็นข้อมูลเริ่มต้นและบันทึกขึ้น Google Sheet แล้ว</p><p class="status-note">ทุกคนที่เข้าเว็บจะเห็นข้อมูลใหม่ทันทีในการโหลดครั้งถัดไป</p>`;
      })
      .catch((err) => {
        $uploadStatus.innerHTML = `<p class="status-err">รีเซ็ตไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
      });
  }

  function bindUploadEvents() {
    $btnOpenUpload.addEventListener("click", requestUploadAccess);
    $btnCloseUpload.addEventListener("click", closeUploadPanel);
    $uploadOverlay.addEventListener("click", (e) => {
      if (e.target === $uploadOverlay) closeUploadPanel();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!$uploadOverlay.hidden) closeUploadPanel();
        if (!$adminLoginOverlay.hidden) closeLoginPanel();
      }
    });

    $btnCloseLogin.addEventListener("click", closeLoginPanel);
    $adminLoginOverlay.addEventListener("click", (e) => {
      if (e.target === $adminLoginOverlay) closeLoginPanel();
    });
    $adminLoginForm.addEventListener("submit", handleLoginSubmit);
    $btnAdminLogout.addEventListener("click", logoutAdmin);
    $btnDownloadTemplate.addEventListener("click", downloadTemplate);

    if ($apiKeyInput) {
      $apiKeyInput.addEventListener("input", (e) => setApiKey(e.target.value.trim()));
    }

    $fileInput.addEventListener("change", (e) => handleFileSelection(e.target.files[0]));

    $dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      $dropzone.classList.add("drag-over");
    });
    $dropzone.addEventListener("dragleave", () => $dropzone.classList.remove("drag-over"));
    $dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      $dropzone.classList.remove("drag-over");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      handleFileSelection(file);
    });

    $btnResetData.addEventListener("click", resetToDefaultData);
  }

  // ---------- Event wiring ----------
  function debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function resetAll() {
    state = { query: "", province: "", district: "", evType: "", service: "", activeChip: "", sort: "name-asc" };
    $searchInput.value = "";
    $provinceSelect.value = "";
    $districtSelect.value = "";
    $evTypeSelect.value = "";
    $serviceSelect.value = "";
    $sortSelect.value = "name-asc";
    $quickChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    render();
  }

  function bindEvents() {
    $searchInput.addEventListener(
      "input",
      debounce((e) => {
        state.query = e.target.value;
        render();
      }, 150)
    );

    $provinceSelect.addEventListener("change", (e) => {
      state.province = e.target.value;
      render();
    });

    $districtSelect.addEventListener("change", (e) => {
      state.district = e.target.value;
      render();
    });

    $evTypeSelect.addEventListener("change", (e) => {
      state.evType = e.target.value;
      render();
    });

    $serviceSelect.addEventListener("change", (e) => {
      state.service = e.target.value;
      state.activeChip = "";
      $quickChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      render();
    });

    $sortSelect.addEventListener("change", (e) => {
      state.sort = e.target.value;
      render();
    });

    $btnReset.addEventListener("click", resetAll);
  }

  // ---------- Init ----------
  async function init() {
    allGarages = await loadData();
    $headerTotal.textContent = allGarages.length + " รายการในฐานข้อมูล";
    populateFilters(allGarages);
    bindEvents();
    bindUploadEvents();
    bindQrEvents();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
