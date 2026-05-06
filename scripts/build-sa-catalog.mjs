import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = "C:/Users/LENOVO/Downloads/kagie-complete";
const workbookPath = path.join(ROOT, "tmp_national_ordinary_schools.xls");
const outputPath = path.join(ROOT, "js", "sa-catalog.js");

const PROVINCE_NAME_BY_CODE = {
  EC: "Eastern Cape",
  FS: "Free State",
  GP: "Gauteng",
  KZN: "KwaZulu-Natal",
  LP: "Limpopo",
  MP: "Mpumalanga",
  NW: "North West",
  NC: "Northern Cape",
  WC: "Western Cape"
};

const NSC_SUBJECTS = [
  "Accounting",
  "Afrikaans First Additional Language",
  "Afrikaans Home Language",
  "Afrikaans Second Additional Language",
  "Agricultural Management Practices",
  "Agricultural Sciences",
  "Agricultural Technology",
  "Business Studies",
  "Civil Technology",
  "Computer Applications Technology",
  "Consumer Studies",
  "Dance Studies",
  "Design",
  "Dramatic Arts",
  "Economics",
  "Electrical Technology",
  "Engineering Graphics and Design",
  "English First Additional Language",
  "English Home Language",
  "English Second Additional Language",
  "Geography",
  "History",
  "Hospitality Studies",
  "Information Technology",
  "isiNdebele First Additional Language",
  "isiNdebele Home Language",
  "isiXhosa First Additional Language",
  "isiXhosa Home Language",
  "isiZulu First Additional Language",
  "isiZulu Home Language",
  "Life Orientation",
  "Life Sciences",
  "Marine Sciences",
  "Mathematical Literacy",
  "Mathematics",
  "Mechanical Technology",
  "Music",
  "Physical Sciences",
  "Religion Studies",
  "Sepedi First Additional Language",
  "Sepedi Home Language",
  "Sesotho First Additional Language",
  "Sesotho Home Language",
  "Setswana First Additional Language",
  "Setswana Home Language",
  "Siswati First Additional Language",
  "Siswati Home Language",
  "South African Sign Language Home Language",
  "Technical Mathematics",
  "Technical Sciences",
  "Tourism",
  "Tshivenda First Additional Language",
  "Tshivenda Home Language",
  "Visual Arts",
  "Xitsonga First Additional Language",
  "Xitsonga Home Language"
];

const INSTITUTION_MASTERLIST = [
  { id: "cput", name: "Cape Peninsula University of Technology", shortName: "CPUT", province: "Western Cape", type: "University of Technology" },
  { id: "cut", name: "Central University of Technology, Free State", shortName: "CUT", province: "Free State", type: "University of Technology" },
  { id: "dut", name: "Durban University of Technology", shortName: "DUT", province: "KwaZulu-Natal", type: "University of Technology" },
  { id: "mut", name: "Mangosuthu University of Technology", shortName: "MUT", province: "KwaZulu-Natal", type: "University of Technology" },
  { id: "nmu", name: "Nelson Mandela University", shortName: "NMU", province: "Eastern Cape", type: "University" },
  { id: "nwu", name: "North-West University", shortName: "NWU", province: "North West", type: "University" },
  { id: "ru", name: "Rhodes University", shortName: "RU", province: "Eastern Cape", type: "University" },
  { id: "smu", name: "Sefako Makgatho Health Sciences University", shortName: "SMU", province: "Gauteng", type: "University" },
  { id: "spu", name: "Sol Plaatje University", shortName: "SPU", province: "Northern Cape", type: "University" },
  { id: "sun", name: "Stellenbosch University", shortName: "SU", province: "Western Cape", type: "University" },
  { id: "tut", name: "Tshwane University of Technology", shortName: "TUT", province: "Gauteng", type: "University of Technology" },
  { id: "uct", name: "University of Cape Town", shortName: "UCT", province: "Western Cape", type: "University" },
  { id: "ufh", name: "University of Fort Hare", shortName: "UFH", province: "Eastern Cape", type: "University" },
  { id: "uj", name: "University of Johannesburg", shortName: "UJ", province: "Gauteng", type: "University" },
  { id: "ukzn", name: "University of KwaZulu-Natal", shortName: "UKZN", province: "KwaZulu-Natal", type: "University" },
  { id: "ul", name: "University of Limpopo", shortName: "UL", province: "Limpopo", type: "University" },
  { id: "ump", name: "University of Mpumalanga", shortName: "UMP", province: "Mpumalanga", type: "University" },
  { id: "up", name: "University of Pretoria", shortName: "UP", province: "Gauteng", type: "University" },
  { id: "unisa", name: "University of South Africa", shortName: "UNISA", province: "Gauteng", type: "University" },
  { id: "ufs", name: "University of the Free State", shortName: "UFS", province: "Free State", type: "University" },
  { id: "uwc", name: "University of the Western Cape", shortName: "UWC", province: "Western Cape", type: "University" },
  { id: "wits", name: "University of the Witwatersrand", shortName: "Wits", province: "Gauteng", type: "University" },
  { id: "univen", name: "University of Venda", shortName: "UNIVEN", province: "Limpopo", type: "University" },
  { id: "unizulu", name: "University of Zululand", shortName: "UNIZULU", province: "KwaZulu-Natal", type: "University" },
  { id: "vut", name: "Vaal University of Technology", shortName: "VUT", province: "Gauteng", type: "University of Technology" },
  { id: "wsu", name: "Walter Sisulu University", shortName: "WSU", province: "Eastern Cape", type: "University" },

  { id: "buffalo-city-tvet", name: "Buffalo City TVET College", shortName: "Buffalo City TVET", province: "Eastern Cape", type: "TVET" },
  { id: "eastcape-midlands-tvet", name: "Eastcape Midlands TVET College", shortName: "Eastcape Midlands TVET", province: "Eastern Cape", type: "TVET" },
  { id: "ikhala-tvet", name: "Ikhala TVET College", shortName: "Ikhala TVET", province: "Eastern Cape", type: "TVET" },
  { id: "ingwe-tvet", name: "Ingwe TVET College", shortName: "Ingwe TVET", province: "Eastern Cape", type: "TVET" },
  { id: "king-hintsa-tvet", name: "King Hintsa TVET College", shortName: "King Hintsa TVET", province: "Eastern Cape", type: "TVET" },
  { id: "ksd-tvet", name: "King Sabata Dalindyebo TVET College", shortName: "KSD TVET", province: "Eastern Cape", type: "TVET" },
  { id: "lovedale-tvet", name: "Lovedale TVET College", shortName: "Lovedale TVET", province: "Eastern Cape", type: "TVET" },
  { id: "port-elizabeth-tvet", name: "Port Elizabeth TVET College", shortName: "PE TVET", province: "Eastern Cape", type: "TVET" },

  { id: "flavius-mareka-tvet", name: "Flavius Mareka TVET College", shortName: "Flavius Mareka TVET", province: "Free State", type: "TVET" },
  { id: "goldfields-tvet", name: "Goldfields TVET College", shortName: "Goldfields TVET", province: "Free State", type: "TVET" },
  { id: "maluti-tvet", name: "Maluti TVET College", shortName: "Maluti TVET", province: "Free State", type: "TVET" },
  { id: "motheo-tvet", name: "Motheo TVET College", shortName: "Motheo TVET", province: "Free State", type: "TVET" },

  { id: "central-johannesburg-tvet", name: "Central Johannesburg TVET College", shortName: "CJC", province: "Gauteng", type: "TVET" },
  { id: "ekurhuleni-east-tvet", name: "Ekurhuleni East TVET College", shortName: "EEC", province: "Gauteng", type: "TVET" },
  { id: "ekurhuleni-west-tvet", name: "Ekurhuleni West TVET College", shortName: "EWC", province: "Gauteng", type: "TVET" },
  { id: "sedibeng-tvet", name: "Sedibeng TVET College", shortName: "Sedibeng TVET", province: "Gauteng", type: "TVET" },
  { id: "swgc", name: "South West Gauteng TVET College", shortName: "SWGC", province: "Gauteng", type: "TVET" },
  { id: "tshwane-north-tvet", name: "Tshwane North TVET College", shortName: "TNC", province: "Gauteng", type: "TVET" },
  { id: "tshwane-south-tvet", name: "Tshwane South TVET College", shortName: "TSC", province: "Gauteng", type: "TVET" },
  { id: "westcol-tvet", name: "Western TVET College", shortName: "Westcol", province: "Gauteng", type: "TVET" },

  { id: "coastal-tvet", name: "Coastal TVET College", shortName: "Coastal TVET", province: "KwaZulu-Natal", type: "TVET" },
  { id: "elangeni-tvet", name: "Elangeni TVET College", shortName: "Elangeni TVET", province: "KwaZulu-Natal", type: "TVET" },
  { id: "esayidi-tvet", name: "Esayidi TVET College", shortName: "Esayidi TVET", province: "KwaZulu-Natal", type: "TVET" },
  { id: "majuba-tvet", name: "Majuba TVET College", shortName: "Majuba TVET", province: "KwaZulu-Natal", type: "TVET" },
  { id: "mnambithi-tvet", name: "Mnambithi TVET College", shortName: "Mnambithi TVET", province: "KwaZulu-Natal", type: "TVET" },
  { id: "mthashana-tvet", name: "Mthashana TVET College", shortName: "Mthashana TVET", province: "KwaZulu-Natal", type: "TVET" },
  { id: "thekwini-tvet", name: "Thekwini TVET College", shortName: "Thekwini TVET", province: "KwaZulu-Natal", type: "TVET" },
  { id: "umfolozi-tvet", name: "Umfolozi TVET College", shortName: "Umfolozi TVET", province: "KwaZulu-Natal", type: "TVET" },
  { id: "umgungundlovu-tvet", name: "uMgungundlovu TVET College", shortName: "uMgungundlovu TVET", province: "KwaZulu-Natal", type: "TVET" },

  { id: "capricorn-tvet", name: "Capricorn TVET College", shortName: "Capricorn TVET", province: "Limpopo", type: "TVET" },
  { id: "lephalale-tvet", name: "Lephalale TVET College", shortName: "Lephalale TVET", province: "Limpopo", type: "TVET" },
  { id: "letaba-tvet", name: "Letaba TVET College", shortName: "Letaba TVET", province: "Limpopo", type: "TVET" },
  { id: "mopani-south-east-tvet", name: "Mopani South East TVET College", shortName: "Mopani South East TVET", province: "Limpopo", type: "TVET" },
  { id: "sekhukhune-tvet", name: "Sekhukhune TVET College", shortName: "Sekhukhune TVET", province: "Limpopo", type: "TVET" },
  { id: "vhembe-tvet", name: "Vhembe TVET College", shortName: "Vhembe TVET", province: "Limpopo", type: "TVET" },
  { id: "waterberg-tvet", name: "Waterberg TVET College", shortName: "Waterberg TVET", province: "Limpopo", type: "TVET" },

  { id: "ehlanzeni-tvet", name: "Ehlanzeni TVET College", shortName: "Ehlanzeni TVET", province: "Mpumalanga", type: "TVET" },
  { id: "gert-sibande-tvet", name: "Gert Sibande TVET College", shortName: "Gert Sibande TVET", province: "Mpumalanga", type: "TVET" },
  { id: "nkangala-tvet", name: "Nkangala TVET College", shortName: "Nkangala TVET", province: "Mpumalanga", type: "TVET" },

  { id: "orbit-tvet", name: "Orbit TVET College", shortName: "Orbit TVET", province: "North West", type: "TVET" },
  { id: "taletso-tvet", name: "Taletso TVET College", shortName: "Taletso TVET", province: "North West", type: "TVET" },
  { id: "vuselela-tvet", name: "Vuselela TVET College", shortName: "Vuselela TVET", province: "North West", type: "TVET" },

  { id: "northern-cape-rural-tvet", name: "Northern Cape Rural TVET College", shortName: "NCR TVET", province: "Northern Cape", type: "TVET" },
  { id: "northern-cape-urban-tvet", name: "Northern Cape Urban TVET College", shortName: "NCU TVET", province: "Northern Cape", type: "TVET" },

  { id: "boland-tvet", name: "Boland TVET College", shortName: "Boland TVET", province: "Western Cape", type: "TVET" },
  { id: "college-of-cape-town", name: "College of Cape Town", shortName: "CCT", province: "Western Cape", type: "TVET" },
  { id: "false-bay-tvet", name: "False Bay TVET College", shortName: "False Bay TVET", province: "Western Cape", type: "TVET" },
  { id: "northlink-tvet", name: "Northlink TVET College", shortName: "Northlink TVET", province: "Western Cape", type: "TVET" },
  { id: "south-cape-tvet", name: "South Cape TVET College", shortName: "South Cape TVET", province: "Western Cape", type: "TVET" },
  { id: "west-coast-tvet", name: "West Coast TVET College", shortName: "West Coast TVET", province: "Western Cape", type: "TVET" }
];

function normalizePhone(value) {
  const raw = String(value || "").trim();
  return raw && raw !== "99" ? raw : "";
}

function deriveSchoolType(row) {
  const sector = String(row.Sector || "").toUpperCase();
  if (sector === "PUBLIC") return "Public";
  if (sector === "INDEPENDENT") return "Private";
  return "Other";
}

function buildHighSchools() {
  const workbook = XLSX.readFile(workbookPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const seen = new Set();
  return rows
    .filter((row) => /SECONDARY|COMBINED/i.test(String(row.Phase || "")))
    .map((row) => ({
      id: `school_${row.NatEmis}`,
      name: String(row.Institution_Name || "").trim(),
      provinceCode: String(row.Province || "").trim(),
      province: PROVINCE_NAME_BY_CODE[String(row.Province || "").trim()] || String(row.Province || "").trim(),
      phase: String(row.Phase || "").trim(),
      schoolType: deriveSchoolType(row),
      district: String(row.EIDistrict || row.Magisterial_District || "").trim(),
      municipality: String(row.LMunName || row.DMunName || "").trim(),
      town: String(row.Town_City || row.Township_Village || "").trim(),
      address: String(row.StreetAddress || row.PostalAddress || "").trim(),
      phone: normalizePhone(row.Telephone),
      email: String(row.E_Mail || "").trim().toLowerCase()
    }))
    .filter((school) => school.name && school.province && !seen.has(school.id) && (seen.add(school.id) || true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildOutput() {
  const highSchools = buildHighSchools();
  const payload = {
    generatedAt: new Date().toISOString(),
    sourceWorkbook: path.basename(workbookPath),
    institutions: INSTITUTION_MASTERLIST,
    nscSubjects: NSC_SUBJECTS,
    highSchools
  };

  const file = `(function () {
  "use strict";

  const catalog = ${JSON.stringify(payload, null, 2)};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function buildGroupedInstitutions(records) {
    return (records || []).reduce((acc, institution) => {
      acc[institution.province] = acc[institution.province] || {};
      acc[institution.province][institution.type] = acc[institution.province][institution.type] || {};
      acc[institution.province][institution.type][institution.name] = (institution.faculties || []).reduce((facAcc, faculty) => {
        facAcc[faculty.name] = (faculty.courses || []).slice();
        return facAcc;
      }, {});
      return acc;
    }, {});
  }

  const existing = window.KagieData || {};
  const existingInstitutions = Array.isArray(existing.institutions) ? existing.institutions : [];
  const detailedByName = new Map(existingInstitutions.map((institution) => [institution.name, institution]));

  const institutions = catalog.institutions.map((institution) => {
    const detailed = detailedByName.get(institution.name) || null;
    return {
      logo: "",
      applicationDeadline: "",
      faculties: [],
      courseEntryMode: "manual",
      ...institution,
      ...(detailed || {}),
      faculties: Array.isArray(detailed?.faculties) ? clone(detailed.faculties) : [],
      courseEntryMode: Array.isArray(detailed?.faculties) && detailed.faculties.length ? "guided" : "manual"
    };
  });

  const prospectus = institutions.map((institution) => ({
    id: institution.id,
    institution: institution.name,
    shortName: institution.shortName,
    province: institution.province,
    type: institution.type,
    year: "2026",
    logo: institution.logo || "",
    summary: institution.faculties?.length
      ? \`\${institution.name} offers \${institution.faculties.length} curated study areas inside Kagie.\`
      : \`\${institution.name} is available in Kagie with manual faculty and course capture while the full prospectus catalogue is being expanded.\`,
    applicationDeadline: institution.applicationDeadline || ""
  }));

  window.KagieData = {
    ...existing,
    generatedAt: catalog.generatedAt,
    dbeSubjects: clone(catalog.nscSubjects),
    iebSubjects: clone(catalog.nscSubjects),
    nscSubjects: clone(catalog.nscSubjects),
    highSchools: clone(catalog.highSchools),
    institutions,
    prospectus
  };

  window.KAGIE_NSC_SUBJECTS = clone(catalog.nscSubjects);
  window.KAGIE_HIGH_SCHOOLS = clone(catalog.highSchools);
  window.KAGIE_INSTITUTIONS = institutions.map((institution) => ({
    province: institution.province,
    name: institution.name,
    type: institution.type,
    faculties: (institution.faculties || []).map((faculty) => ({
      name: faculty.name,
      courses: (faculty.courses || []).slice()
    })),
    courseEntryMode: institution.courseEntryMode || "manual"
  }));
  window.KAGIE_INSTITUTIONS_GROUPED = buildGroupedInstitutions(institutions);
})();\n`;

  fs.writeFileSync(outputPath, file, "utf8");
  console.log(`Built South Africa catalog with ${highSchools.length} high schools and ${INSTITUTION_MASTERLIST.length} tertiary institutions.`);
}

buildOutput();
