/**
 * Code.gs — EV Garage Finder backend (Google Apps Script Web App)
 * ---------------------------------------------------------------
 * ทำหน้าที่แทนที่ data/database.json บน GitHub — ตัว Google Sheet นี้
 * เป็นฐานข้อมูลจริง (source of truth) เพียงที่เดียว โครงสร้างข้อมูล (schema)
 * เหมือนเดิมทุกฟิลด์ ไม่เปลี่ยน:
 *   id, province, district, name, evTypes, services, contact, phone,
 *   line, lineQr, facebook, googleMaps, hours, notes
 * (evTypes และ services เก็บในชีตเป็นข้อความคั่นด้วยจุลภาค แล้วแปลงกลับเป็น
 * array ตอนส่งออกเป็น JSON ให้เว็บ เพื่อให้ตรงกับรูปแบบเดิมทุกประการ)
 *
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. สร้าง Google Sheet ใหม่ (เปล่าๆ ก็ได้ ไม่ต้องพิมพ์อะไรเอง)
 * 2. เมนู Extensions > Apps Script แล้ววางไฟล์นี้ทั้งหมดแทนโค้ดเริ่มต้น
 * 3. ที่แถบซ้าย Project Settings (รูปเฟือง) > Script Properties
 *    > Add script property: key = API_KEY, value = รหัสลับที่ตั้งเอง (สุ่มยาวๆ)
 *    (รหัสนี้จะไม่ถูก commit ขึ้น GitHub เลย เพราะเก็บอยู่ฝั่ง Apps Script เท่านั้น)
 * 4. กลับมาที่ตัวแก้ไขโค้ด เลือกฟังก์ชัน seedInitialData แล้วกด Run ครั้งเดียว
 *    (จะขึ้น popup ขอสิทธิ์ - อนุญาตได้เลย) เพื่อสร้างชีต "Garages" พร้อมข้อมูลเริ่มต้น
 * 5. กดปุ่ม Deploy > New deployment > เลือกประเภท "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    กด Deploy แล้วคัดลอก "Web app URL" ที่ได้ (ลงท้ายด้วย /exec)
 * 6. เอา URL นั้นไปใส่ในค่า APPS_SCRIPT_URL ที่ไฟล์ js/app.js ของเว็บ
 *
 * ทุกครั้งที่แก้โค้ดนี้แล้วต้อง Deploy > Manage deployments > แก้ไข (ไอคอนดินสอ)
 * > เลือก Version: New version > Deploy ใหม่ ไม่งั้น Web app จะยังใช้โค้ดเวอร์ชันเก่า
 */

const SHEET_NAME = "Garages";
const HEADERS = ["id", "province", "district", "name", "evTypes", "services",
  "contact", "phone", "line", "lineQr", "facebook", "googleMaps", "hours", "notes"];
const MULTI_VALUE_FIELDS = ["evTypes", "services"];

// ---------- Sheet helpers ----------
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rowsToRecords_(values) {
  const rows = values.slice();
  const headers = rows.shift().map((h) => String(h).trim());
  return rows
    .filter((row) => row.some((cell) => String(cell).trim() !== ""))
    .map((row) => {
      const rec = {};
      headers.forEach((h, i) => {
        const val = row[i];
        if (MULTI_VALUE_FIELDS.indexOf(h) !== -1) {
          rec[h] = String(val || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          rec[h] = val === undefined || val === null ? "" : String(val).trim();
        }
      });
      return rec;
    });
}

function recordsToRows_(records) {
  return records.map((rec) =>
    HEADERS.map((h) => {
      const v = rec[h];
      if (MULTI_VALUE_FIELDS.indexOf(h) !== -1) {
        return Array.isArray(v) ? v.join(", ") : v || "";
      }
      return v === undefined || v === null ? "" : v;
    })
  );
}

function writeAllRecords_(sheet, records) {
  sheet.clearContents();
  sheet.appendRow(HEADERS);
  const rows = recordsToRows_(records);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }
}

function getApiKey_() {
  return PropertiesService.getScriptProperties().getProperty("API_KEY") || "";
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ---------- Web app entry points ----------
// GET: ใครก็เรียกได้ (สาธารณะ) — คืนรายการอู่ทั้งหมดเป็น JSON array
// เหมือนรูปแบบเดิมของ data/database.json ทุกประการ
function doGet(e) {
  const sheet = getSheet_();
  const records = rowsToRecords_(sheet.getDataRange().getValues());
  return jsonOutput_(records);
}

// POST: ต้องแนบ apiKey ที่ตรงกับ Script property "API_KEY" เท่านั้นถึงจะเขียนได้
// Body: { "apiKey": "...", "mode": "merge" | "replace", "garages": [ ... ] }
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.apiKey !== getApiKey_() || !getApiKey_()) {
      return jsonOutput_({ ok: false, error: "API key ไม่ถูกต้อง หรือยังไม่ได้ตั้งค่า API_KEY ใน Script Properties" });
    }

    const sheet = getSheet_();
    const incoming = Array.isArray(payload.garages) ? payload.garages : [];
    const mode = payload.mode === "replace" ? "replace" : "merge";

    let finalRecords;
    if (mode === "replace") {
      finalRecords = incoming;
    } else {
      const existing = rowsToRecords_(sheet.getDataRange().getValues());
      const byId = {};
      existing.forEach((g) => {
        byId[g.id] = g;
      });
      incoming.forEach((g) => {
        byId[g.id] = g;
      });
      finalRecords = Object.keys(byId).map((k) => byId[k]);
    }

    writeAllRecords_(sheet, finalRecords);
    return jsonOutput_({ ok: true, count: finalRecords.length });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err.message || err) });
  }
}

// ---------- One-time setup helper ----------
// รันเองครั้งเดียวจากตัวแก้ไข Apps Script (เลือกฟังก์ชันนี้แล้วกด Run) เพื่อสร้าง
// ชีต "Garages" พร้อมข้อมูลเริ่มต้น 14 อู่ตัวอย่าง (ชุดเดียวกับที่เคยอยู่ใน
// data/database.json / js/data.js เดิม) — ถ้าชีตมีข้อมูลอยู่แล้วจะไม่ทับ
function seedInitialData() {
  const sheet = getSheet_();
  const existing = rowsToRecords_(sheet.getDataRange().getValues());
  if (existing.length > 0) {
    Logger.log("ชีตมีข้อมูลอยู่แล้ว (%s แถว) — ข้ามการ seed เพื่อไม่ให้ทับข้อมูลจริง", existing.length);
    return;
  }
  const seedData = SEED_DATA_JSON;
  writeAllRecords_(sheet, seedData);
  Logger.log("Seed ข้อมูลเริ่มต้นสำเร็จ: %s รายการ", seedData.length);
}

const SEED_DATA_JSON = [
  {
    "id": "PK-001",
    "province": "นครราชสีมา",
    "district": "เมืองนครราชสีมา",
    "name": "P&K New Energy Service Center",
    "evTypes": [
      "BYD",
      "NETA",
      "MG",
      "GAC AION",
      "ทุกยี่ห้อ"
    ],
    "services": [
      "แบตเตอรี่แรงดันสูง (HV Battery)",
      "ระบบปรับอากาศ (HVAC)",
      "ระบบชาร์จ/OBC",
      "ระบบไฟฟ้า/ECU",
      "ตรวจเช็คทั่วไป (PM)"
    ],
    "contact": "จตุรงค์",
    "phone": "081-234-5678",
    "line": "@pknewenergy",
    "facebook": "https://facebook.com/pknewenergyservice",
    "googleMaps": "https://maps.google.com/?q=P%26K+New+Energy+Service+Center+Nakhon+Ratchasima",
    "hours": "จันทร์-เสาร์ 08:30-18:00",
    "notes": "ศูนย์บริการเฉพาะทางรถยนต์ไฟฟ้า มีเครื่องมือวิเคราะห์แบตเตอรี่และรับตรวจเช็ค HV โดยเฉพาะ"
  },
  {
    "id": "EV-002",
    "province": "นครราชสีมา",
    "district": "ปากช่อง",
    "name": "ปากช่อง EV Care",
    "evTypes": [
      "BYD",
      "MG",
      "ทุกยี่ห้อ"
    ],
    "services": [
      "ระบบปรับอากาศ (HVAC)",
      "ตรวจเช็คทั่วไป (PM)",
      "ช่วงล่าง/เบรก"
    ],
    "contact": "คุณอนันต์",
    "phone": "089-112-2345",
    "line": "@pakchongevcare",
    "facebook": "https://facebook.com/pakchongevcare",
    "googleMaps": "https://maps.google.com/?q=Pakchong+EV+Care",
    "hours": "ทุกวัน 09:00-19:00",
    "notes": "รับซ่อมด่วนระหว่างเดินทางสายอีสาน"
  },
  {
    "id": "EV-003",
    "province": "กรุงเทพมหานคร",
    "district": "บางนา",
    "name": "Bangna EV Motorworks",
    "evTypes": [
      "Tesla",
      "BYD",
      "NETA",
      "ORA"
    ],
    "services": [
      "แบตเตอรี่แรงดันสูง (HV Battery)",
      "มอเตอร์/ระบบขับเคลื่อน",
      "ระบบไฟฟ้า/ECU"
    ],
    "contact": "คุณวีระ",
    "phone": "02-345-6789",
    "line": "@bangnaev",
    "facebook": "https://facebook.com/bangnaevmotorworks",
    "googleMaps": "https://maps.google.com/?q=Bangna+EV+Motorworks",
    "hours": "จันทร์-เสาร์ 09:00-18:30",
    "notes": "มีศูนย์ตรวจสอบแบตเตอรี่ด้วย Insulation Tester และ Cell Balancer"
  },
  {
    "id": "EV-004",
    "province": "ชลบุรี",
    "district": "ศรีราชา",
    "name": "Sriracha Volt Garage",
    "evTypes": [
      "BYD",
      "GAC AION",
      "Changan"
    ],
    "services": [
      "ระบบชาร์จ/OBC",
      "ระบบปรับอากาศ (HVAC)",
      "ตรวจเช็คทั่วไป (PM)"
    ],
    "contact": "คุณสมชาย",
    "phone": "038-778-899",
    "line": "@sriracha_volt",
    "facebook": "https://facebook.com/srirachavolt",
    "googleMaps": "https://maps.google.com/?q=Sriracha+Volt+Garage",
    "hours": "จันทร์-เสาร์ 08:00-17:30",
    "notes": "ใกล้นิคมอุตสาหกรรม รองรับรถองค์กร"
  },
  {
    "id": "EV-005",
    "province": "เชียงใหม่",
    "district": "เมืองเชียงใหม่",
    "name": "Lanna EV Clinic",
    "evTypes": [
      "MG",
      "NETA",
      "BYD",
      "ทุกยี่ห้อ"
    ],
    "services": [
      "แบตเตอรี่แรงดันสูง (HV Battery)",
      "ช่วงล่าง/เบรก",
      "ตรวจเช็คทั่วไป (PM)"
    ],
    "contact": "คุณพิมพ์ใจ",
    "phone": "053-224-556",
    "line": "@lannaevclinic",
    "facebook": "https://facebook.com/lannaevclinic",
    "googleMaps": "https://maps.google.com/?q=Lanna+EV+Clinic+Chiang+Mai",
    "hours": "จันทร์-เสาร์ 09:00-18:00",
    "notes": "ทีมช่างผ่านการอบรม HV Safety โดยตรงจากค่ายรถ"
  },
  {
    "id": "EV-006",
    "province": "ขอนแก่น",
    "district": "เมืองขอนแก่น",
    "name": "Isan EV Power",
    "evTypes": [
      "BYD",
      "GAC AION"
    ],
    "services": [
      "ระบบไฟฟ้า/ECU",
      "ระบบชาร์จ/OBC",
      "ตรวจเช็คทั่วไป (PM)"
    ],
    "contact": "คุณเอกชัย",
    "phone": "043-556-778",
    "line": "@isanevpower",
    "facebook": "https://facebook.com/isanevpower",
    "googleMaps": "https://maps.google.com/?q=Isan+EV+Power+Khon+Kaen",
    "hours": "จันทร์-อาทิตย์ 08:30-18:00",
    "notes": "รับงานฟลีทแท็กซี่ไฟฟ้าในพื้นที่"
  },
  {
    "id": "EV-007",
    "province": "ภูเก็ต",
    "district": "เมืองภูเก็ต",
    "name": "Phuket Green Motor",
    "evTypes": [
      "Tesla",
      "BYD",
      "MG",
      "ORA"
    ],
    "services": [
      "แบตเตอรี่แรงดันสูง (HV Battery)",
      "ระบบปรับอากาศ (HVAC)",
      "มอเตอร์/ระบบขับเคลื่อน"
    ],
    "contact": "คุณนภดล",
    "phone": "076-334-556",
    "line": "@phuketgreenmotor",
    "facebook": "https://facebook.com/phuketgreenmotor",
    "googleMaps": "https://maps.google.com/?q=Phuket+Green+Motor",
    "hours": "ทุกวัน 09:00-19:00",
    "notes": "รองรับนักท่องเที่ยวเช่ารถไฟฟ้า มีบริการรถลากฉุกเฉิน"
  },
  {
    "id": "EV-008",
    "province": "สงขลา",
    "district": "หาดใหญ่",
    "name": "Hatyai EV Solutions",
    "evTypes": [
      "NETA",
      "BYD",
      "Changan"
    ],
    "services": [
      "ระบบไฟฟ้า/ECU",
      "ช่วงล่าง/เบรก",
      "ตรวจเช็คทั่วไป (PM)"
    ],
    "contact": "คุณอาทิตย์",
    "phone": "074-223-445",
    "line": "@hatyaiev",
    "facebook": "https://facebook.com/hatyaievsolutions",
    "googleMaps": "https://maps.google.com/?q=Hatyai+EV+Solutions",
    "hours": "จันทร์-เสาร์ 08:30-17:30",
    "notes": ""
  },
  {
    "id": "EV-009",
    "province": "นนทบุรี",
    "district": "บางบัวทอง",
    "name": "Bangbuathong EV Tech",
    "evTypes": [
      "MG",
      "BYD",
      "GAC AION",
      "ทุกยี่ห้อ"
    ],
    "services": [
      "แบตเตอรี่แรงดันสูง (HV Battery)",
      "ระบบชาร์จ/OBC",
      "ระบบปรับอากาศ (HVAC)"
    ],
    "contact": "คุณกิตติ",
    "phone": "02-889-9001",
    "line": "@bbtevtech",
    "facebook": "https://facebook.com/bangbuathongevtech",
    "googleMaps": "https://maps.google.com/?q=Bangbuathong+EV+Tech",
    "hours": "จันทร์-เสาร์ 09:00-18:00",
    "notes": "มีบริการรับ-ส่งรถในเขตนนทบุรี"
  },
  {
    "id": "EV-010",
    "province": "ปทุมธานี",
    "district": "คลองหลวง",
    "name": "Klongluang EV Garage",
    "evTypes": [
      "NETA",
      "BYD"
    ],
    "services": [
      "ตรวจเช็คทั่วไป (PM)",
      "ช่วงล่าง/เบรก",
      "ระบบไฟฟ้า/ECU"
    ],
    "contact": "คุณธนพล",
    "phone": "02-902-3344",
    "line": "@klongluangev",
    "facebook": "https://facebook.com/klongluangevgarage",
    "googleMaps": "https://maps.google.com/?q=Klongluang+EV+Garage",
    "hours": "จันทร์-เสาร์ 08:00-17:00",
    "notes": ""
  },
  {
    "id": "EV-011",
    "province": "สมุทรปราการ",
    "district": "บางพลี",
    "name": "Bangplee HV Battery Lab",
    "evTypes": [
      "BYD",
      "MG",
      "NETA",
      "GAC AION",
      "ทุกยี่ห้อ"
    ],
    "services": [
      "แบตเตอรี่แรงดันสูง (HV Battery)",
      "มอเตอร์/ระบบขับเคลื่อน"
    ],
    "contact": "คุณศิริพงษ์",
    "phone": "02-778-4455",
    "line": "@bangpleehvlab",
    "facebook": "https://facebook.com/bangpleehvbatterylab",
    "googleMaps": "https://maps.google.com/?q=Bangplee+HV+Battery+Lab",
    "hours": "จันทร์-เสาร์ 09:00-18:00",
    "notes": "ห้องแล็บเฉพาะทางวิเคราะห์และ Rebalance แบตเตอรี่"
  },
  {
    "id": "EV-012",
    "province": "อุดรธานี",
    "district": "เมืองอุดรธานี",
    "name": "Udon EV Point",
    "evTypes": [
      "BYD",
      "Changan"
    ],
    "services": [
      "ระบบชาร์จ/OBC",
      "ตรวจเช็คทั่วไป (PM)"
    ],
    "contact": "คุณประวิทย์",
    "phone": "042-112-334",
    "line": "@udonevpoint",
    "facebook": "https://facebook.com/udonevpoint",
    "googleMaps": "https://maps.google.com/?q=Udon+EV+Point",
    "hours": "จันทร์-เสาร์ 08:30-17:30",
    "notes": ""
  },
  {
    "id": "EV-013",
    "province": "สุราษฎร์ธานี",
    "district": "เมืองสุราษฎร์ธานี",
    "name": "Surat EV Garage",
    "evTypes": [
      "MG",
      "NETA",
      "ทุกยี่ห้อ"
    ],
    "services": [
      "ระบบปรับอากาศ (HVAC)",
      "ช่วงล่าง/เบรก",
      "ตรวจเช็คทั่วไป (PM)"
    ],
    "contact": "คุณจิรายุ",
    "phone": "077-556-778",
    "line": "@suratevgarage",
    "facebook": "https://facebook.com/suratevgarage",
    "googleMaps": "https://maps.google.com/?q=Surat+EV+Garage",
    "hours": "จันทร์-อาทิตย์ 09:00-18:00",
    "notes": ""
  },
  {
    "id": "EV-014",
    "province": "นครราชสีมา",
    "district": "สีคิ้ว",
    "name": "Sikhio EV Express",
    "evTypes": [
      "BYD",
      "NETA",
      "ทุกยี่ห้อ"
    ],
    "services": [
      "ตรวจเช็คทั่วไป (PM)",
      "ช่วงล่าง/เบรก"
    ],
    "contact": "คุณมานพ",
    "phone": "085-667-889",
    "line": "@sikhioevexpress",
    "facebook": "",
    "googleMaps": "https://maps.google.com/?q=Sikhio+EV+Express",
    "hours": "จันทร์-เสาร์ 08:00-18:00",
    "notes": "จุดพักรถระหว่างทางสาย มิตรภาพ"
  }
];
