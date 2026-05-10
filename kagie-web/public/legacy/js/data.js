(function () {
  "use strict";

  const provinces = [
    "Eastern Cape",
    "Free State",
    "Gauteng",
    "KwaZulu-Natal",
    "Limpopo",
    "Mpumalanga",
    "North West",
    "Northern Cape",
    "Western Cape"
  ];

  const homeLanguages = [
    "English",
    "isiZulu",
    "isiXhosa",
    "Sesotho",
    "Setswana",
    "Xitsonga",
    "Tshivenda",
    "Afrikaans",
    "Sepedi",
    "isiNdebele",
    "Siswati"
  ];

  const genders = ["Female", "Male", "Other", "Prefer not to say"];

  const schoolTypes = ["Public", "Private", "TVET", "Adult Education", "Other"];

  const dbeSubjects = [
    "English Home Language",
    "English First Additional Language",
    "isiZulu Home Language",
    "isiXhosa Home Language",
    "Afrikaans Home Language",
    "Mathematics",
    "Mathematical Literacy",
    "Life Orientation",
    "Physical Sciences",
    "Life Sciences",
    "Accounting",
    "Business Studies",
    "Economics",
    "Geography",
    "History",
    "Computer Applications Technology",
    "Information Technology",
    "Tourism",
    "Consumer Studies",
    "Agricultural Sciences",
    "Visual Arts",
    "Dramatic Arts",
    "Engineering Graphics and Design"
  ];

  const applicationPacks = [
    {
      id: "launch",
      name: "Starter Pack",
      price: 250,
      institutionLimit: 10,
      highlight: "Up to 10 institutions with guided Kagie tracking",
      description: "Covers up to 10 institutions with application tracking, profile auto-fill, basic document support, and progress updates."
    },
    {
      id: "growth",
      name: "Smart Choice Pack",
      price: 350,
      institutionLimit: 15,
      highlight: "Wider national coverage with APS and smarter suggestions",
      description: "Everything in Starter, plus APS calculation, smarter course suggestions, and a broader 15-institution shortlist."
    },
    {
      id: "premium",
      name: "Ambition Pack",
      price: 450,
      institutionLimit: 20,
      highlight: "Broader coverage with deadline alerts and stronger planning",
      description: "Everything in Smart Choice, plus deadline alerts, proof-of-submission tracking, and support across 20 institutions."
    },
    {
      id: "concierge",
      name: "Unlimited Pro Pack",
      price: 800,
      institutionLimit: "unlimited",
      highlight: "Maximum coverage with priority handling and deep tracking",
      description: "Everything in Ambition, plus unlimited institution coverage, priority processing, and advanced timeline tracking."
    }
  ];

  const extraServices = [
    {
      id: "accommodation_assist",
      name: "Accommodation Assist",
      slug: "accommodation-assist",
      price: 0,
      pricingLabel: "No upfront fee",
      description: "Browse student housing listings, compare room options, and send a reservation request through Kagie."
    },
    {
      id: "transport_assist",
      name: "Transport Assist",
      slug: "transport-assist",
      price: 0,
      pricingLabel: "Support on request",
      description: "Compare intercity transport routes and send a Kagie travel support request for campus or move-in travel."
    },
    {
      id: "funding_assist",
      name: "Funding Assist",
      slug: "funding-assist",
      price: 220,
      description: "Get NSFAS, bursary, and funding checklist support with one tracked Kagie request."
    },
    {
      id: "change_email",
      name: "Change Email",
      slug: "change-email",
      price: 50,
      description: "Request assistance updating the email linked to your institution portal or student profile."
    },
    {
      id: "re_apply",
      name: "Re-Apply Help",
      slug: "re-apply",
      price: 50,
      description: "Get Kagie support for submitting a fresh or corrective application to the same institution."
    },
    {
      id: "forgot_pin",
      name: "Forgot PIN",
      slug: "forgot-pin",
      price: 10,
      description: "Recover or reset your institution portal PIN through guided support."
    },
    {
      id: "forgot_student_number",
      name: "Forgot Student Number",
      slug: "forgot-student-number",
      price: 10,
      description: "Recover your student number so you can continue with portal access and tracking."
    }
  ];

  function buildSceneArtwork(title, topColor, bottomColor, accentColor) {
    return "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${topColor}"/>
            <stop offset="100%" stop-color="${bottomColor}"/>
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.95)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0.7)"/>
          </linearGradient>
        </defs>
        <rect width="900" height="560" rx="40" fill="url(#sky)"/>
        <circle cx="730" cy="120" r="72" fill="rgba(255,255,255,0.22)"/>
        <path d="M0 420 C180 350 280 500 450 430 C600 370 700 500 900 410 L900 560 L0 560 Z" fill="rgba(255,255,255,0.16)"/>
        <rect x="92" y="160" width="250" height="250" rx="28" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>
        <rect x="150" y="124" width="134" height="36" rx="18" fill="${accentColor}" opacity="0.95"/>
        <rect x="132" y="210" width="60" height="60" rx="14" fill="rgba(255,255,255,0.82)"/>
        <rect x="212" y="210" width="60" height="60" rx="14" fill="rgba(255,255,255,0.82)"/>
        <rect x="132" y="292" width="60" height="60" rx="14" fill="rgba(255,255,255,0.82)"/>
        <rect x="212" y="292" width="60" height="60" rx="14" fill="rgba(255,255,255,0.82)"/>
        <rect x="520" y="172" width="268" height="182" rx="28" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.32)" stroke-width="4"/>
        <rect x="560" y="210" width="188" height="26" rx="13" fill="rgba(255,255,255,0.84)"/>
        <rect x="560" y="252" width="152" height="20" rx="10" fill="rgba(255,255,255,0.64)"/>
        <rect x="560" y="286" width="126" height="20" rx="10" fill="rgba(255,255,255,0.64)"/>
        <rect x="88" y="446" width="724" height="52" rx="26" fill="rgba(15,23,42,0.12)"/>
        <text x="450" y="472" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-size="38" font-weight="800" fill="#ffffff">${title}</text>
      </svg>
    `);
  }

  const accommodationListings = [
    {
      id: "acc_campus_lofts",
      propertyName: "Campus Lofts Durban",
      institutionName: "University of KwaZulu-Natal",
      province: "KwaZulu-Natal",
      location: "Berea, Durban",
      price: 4650,
      roomType: "Single room",
      availabilityStatus: "Available",
      distanceFromCampus: "1.1 km from Howard College",
      images: [buildSceneArtwork("Campus Lofts", "#2fa4ff", "#0f7bd0", "#f5c84c")],
      description: "Modern student apartments with study lounges, Wi-Fi, and secure access close to UKZN.",
      contactPhone: "031 555 0101"
    },
    {
      id: "acc_rosebank_court",
      propertyName: "Rosebank Court Student Living",
      institutionName: "University of Johannesburg",
      province: "Gauteng",
      location: "Auckland Park, Johannesburg",
      price: 5400,
      roomType: "Studio",
      availabilityStatus: "Limited",
      distanceFromCampus: "850 m from campus",
      images: [buildSceneArtwork("Rosebank Court", "#e45a2a", "#c93c16", "#f5c84c")],
      description: "Private studios with biometric access, shuttle support, and shared study zones.",
      contactPhone: "011 555 2222"
    },
    {
      id: "acc_capitol_residence",
      propertyName: "Capitol Student Residence",
      institutionName: "University of Pretoria",
      province: "Gauteng",
      location: "Hatfield, Pretoria",
      price: 4950,
      roomType: "Shared room",
      availabilityStatus: "Available",
      distanceFromCampus: "1.6 km from campus",
      images: [buildSceneArtwork("Capitol Residence", "#14945b", "#0f7b4a", "#67caff")],
      description: "Budget-friendly shared accommodation with laundry, Wi-Fi, and study support spaces.",
      contactPhone: "012 555 4545"
    },
    {
      id: "acc_table_mountain_house",
      propertyName: "Table Mountain Student House",
      institutionName: "University of Cape Town",
      province: "Western Cape",
      location: "Rondebosch, Cape Town",
      price: 6200,
      roomType: "Single room",
      availabilityStatus: "Waitlist",
      distanceFromCampus: "1.4 km from upper campus",
      images: [buildSceneArtwork("Table Mountain House", "#6d7ef8", "#3852d5", "#f5c84c")],
      description: "Premium private rooms with mountain-facing common areas and controlled visitor access.",
      contactPhone: "021 555 8800"
    }
  ];

  const transportOptions = [
    {
      id: "trans_dbn_jhb_intercape",
      company: "Intercape",
      departureCity: "Durban",
      destinationCity: "Johannesburg",
      travelDateLabel: "Daily service",
      routeType: "Intercity coach",
      estimatedPrice: 430,
      supportFee: 60,
      duration: "8h 30m",
      luggage: "2 suitcases + hand luggage",
      description: "Reliable long-distance coach support for students travelling between Durban and Johannesburg."
    },
    {
      id: "trans_plk_pta_city",
      company: "City to City",
      departureCity: "Polokwane",
      destinationCity: "Pretoria",
      travelDateLabel: "Daily service",
      routeType: "Intercity coach",
      estimatedPrice: 310,
      supportFee: 50,
      duration: "4h 20m",
      luggage: "Standard coach luggage policy",
      description: "Useful for move-in and registration trips from Limpopo to Pretoria campuses."
    },
    {
      id: "trans_ec_jhb_eagle",
      company: "Eagle Liner",
      departureCity: "East London",
      destinationCity: "Johannesburg",
      travelDateLabel: "Selected weekdays",
      routeType: "Intercity coach",
      estimatedPrice: 470,
      supportFee: 65,
      duration: "11h 10m",
      luggage: "1 large suitcase + carry-on",
      description: "Long-route option for students heading to Gauteng institutions from the Eastern Cape."
    },
    {
      id: "trans_kimberley_ct_intercape",
      company: "Intercape",
      departureCity: "Kimberley",
      destinationCity: "Cape Town",
      travelDateLabel: "Selected days",
      routeType: "Intercity coach",
      estimatedPrice: 390,
      supportFee: 55,
      duration: "9h 15m",
      luggage: "2 bags included",
      description: "Cape-bound student route for registration and accommodation move-in support."
    }
  ];

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function normalizeInstitutionStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value === "open") return "open";
    if (value === "closing_soon" || value === "closing soon") return "closing_soon";
    if (value === "closed") return "closed";
    return "";
  }

  function deriveInstitutionStatus(record) {
    if (record.isActive === false) return "closed";
    const manual = normalizeInstitutionStatus(record.manualStatus || record.manual_status || "");
    if (manual) return manual;

    const today = todayKey();
    const closingDate = String(record.closingDate || record.closing_date || record.applicationDeadline || "").trim();
    if (!closingDate) return "open";
    if (today > closingDate) return "closed";

    const diffMs = new Date(`${closingDate}T23:59:59`).getTime() - new Date(`${today}T00:00:00`).getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays <= 7) return "closing_soon";
    return "open";
  }

  function normalizeInstitutionRecord(record) {
    const year = String(record.year || record.applicationDeadline?.slice(0, 4) || new Date().getFullYear());
    const closingDate = String(record.closingDate || record.closing_date || record.applicationDeadline || "").trim();
    const openingDate = String(record.openingDate || record.opening_date || `${year}-01-15`).trim();
    const isActive = record.isActive !== false && record.is_active !== false;
    const normalized = {
      ...record,
      year,
      openingDate,
      opening_date: openingDate,
      closingDate,
      closing_date: closingDate,
      applicationDeadline: closingDate,
      isActive,
      is_active: isActive,
      manualStatus: normalizeInstitutionStatus(record.manualStatus || record.manual_status || "")
    };
    return {
      ...normalized,
      status: deriveInstitutionStatus(normalized)
    };
  }

  const rawInstitutions = [
    {
      id: "ukzn",
      name: "University of KwaZulu-Natal",
      shortName: "UKZN",
      province: "KwaZulu-Natal",
      type: "University",
      logo: "images/logos/ukzn.png",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Health Sciences", courses: ["Nursing", "Pharmacy", "Medicine", "Physiotherapy"] },
        { name: "Humanities", courses: ["Education", "Psychology", "Social Work", "Public Administration"] },
        { name: "Engineering", courses: ["Civil Engineering", "Mechanical Engineering", "Chemical Engineering"] }
      ]
    },
    {
      id: "dut",
      name: "Durban University of Technology",
      shortName: "DUT",
      province: "KwaZulu-Natal",
      type: "University of Technology",
      logo: "images/logos/dut.png",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Accounting and Informatics", courses: ["Information Technology", "Accounting", "Internal Auditing"] },
        { name: "Management Sciences", courses: ["Marketing", "Public Management", "Operations Management"] },
        { name: "Engineering and the Built Environment", courses: ["Electrical Engineering", "Civil Engineering", "Construction Management"] }
      ]
    },
    {
      id: "mut",
      name: "Mangosuthu University of Technology",
      shortName: "MUT",
      province: "KwaZulu-Natal",
      type: "University of Technology",
      logo: "",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Engineering", courses: ["Electrical Engineering", "Chemical Engineering", "Surveying"] },
        { name: "Natural Sciences", courses: ["Agriculture", "Biochemistry", "Environmental Health"] },
        { name: "Management Sciences", courses: ["Accounting", "Human Resource Management", "Public Relations"] }
      ]
    },
    {
      id: "unizulu",
      name: "University of Zululand",
      shortName: "UNIZULU",
      province: "KwaZulu-Natal",
      type: "University",
      logo: "",
      applicationDeadline: "2026-10-31",
      faculties: [
        { name: "Education", courses: ["BEd Foundation Phase", "BEd Senior Phase", "Educational Management"] },
        { name: "Science and Agriculture", courses: ["Computer Science", "Geography", "Agricultural Science"] },
        { name: "Commerce", courses: ["Accounting", "Economics", "Business Management"] }
      ]
    },
    {
      id: "coastal-tvet",
      name: "Coastal TVET College",
      shortName: "Coastal TVET",
      province: "KwaZulu-Natal",
      type: "TVET",
      logo: "",
      applicationDeadline: "2026-11-15",
      faculties: [
        { name: "Engineering Studies", courses: ["Electrical Engineering N4", "Mechanical Engineering N4", "Civil Engineering N4"] },
        { name: "Business Studies", courses: ["Financial Management N4", "Business Management N4", "Human Resource Management N4"] },
        { name: "Hospitality", courses: ["Hospitality and Catering", "Travel and Tourism", "Office Administration"] }
      ]
    },
    {
      id: "elangeni-tvet",
      name: "Elangeni TVET College",
      shortName: "Elangeni TVET",
      province: "KwaZulu-Natal",
      type: "TVET",
      logo: "",
      applicationDeadline: "2026-11-15",
      faculties: [
        { name: "Engineering Studies", courses: ["Electrical Engineering N4", "Civil Engineering N4", "Chemical Engineering N4"] },
        { name: "Business Studies", courses: ["Management Assistant N4", "Marketing Management N4", "Financial Management N4"] },
        { name: "ICT", courses: ["IT and Computer Science", "End User Computing", "Systems Development"] }
      ]
    },
    {
      id: "uj",
      name: "University of Johannesburg",
      shortName: "UJ",
      province: "Gauteng",
      type: "University",
      logo: "images/logos/uj.png",
      applicationDeadline: "2026-10-31",
      faculties: [
        { name: "Engineering and the Built Environment", courses: ["Electrical Engineering", "Industrial Engineering", "Architecture"] },
        { name: "Science", courses: ["Biotechnology", "Physics", "Computer Science"] },
        { name: "Education", courses: ["BEd", "Educational Psychology", "Sports Coaching"] }
      ]
    },
    {
      id: "up",
      name: "University of Pretoria",
      shortName: "UP",
      province: "Gauteng",
      type: "University",
      logo: "images/logos/up.png",
      applicationDeadline: "2026-08-31",
      faculties: [
        { name: "Health Sciences", courses: ["Nursing", "Dentistry", "Medicine"] },
        { name: "Education", courses: ["BEd", "Educational Psychology", "Early Childhood Education"] },
        { name: "Economic and Management Sciences", courses: ["BCom Accounting", "Economics", "Human Resource Management"] }
      ]
    },
    {
      id: "tut",
      name: "Tshwane University of Technology",
      shortName: "TUT",
      province: "Gauteng",
      type: "University of Technology",
      logo: "images/logos/tut.png",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Information and Communication Technology", courses: ["Computer Science", "Informatics", "Multimedia Computing"] },
        { name: "Engineering and the Built Environment", courses: ["Civil Engineering", "Electrical Engineering", "Quantity Surveying"] },
        { name: "Human Sciences", courses: ["Journalism", "Integrated Communication", "Tourism Management"] }
      ]
    },
    {
      id: "unisa",
      name: "University of South Africa",
      shortName: "UNISA",
      province: "Gauteng",
      type: "University",
      logo: "images/logos/unisa.png",
      applicationDeadline: "2026-10-13",
      faculties: [
        { name: "Education", courses: ["BEd Foundation Phase", "BEd Senior Phase", "Teaching English as a subject"] },
        { name: "Human Sciences", courses: ["Psychology", "Criminology", "Social Work"] },
        { name: "Science and Technology", courses: ["Computer Science", "Information Systems", "Mathematics"] }
      ]
    },
    {
      id: "swgc",
      name: "South West Gauteng TVET College",
      shortName: "SWGC",
      province: "Gauteng",
      type: "TVET",
      logo: "",
      applicationDeadline: "2026-11-30",
      faculties: [
        { name: "Business Studies", courses: ["Business Management N4", "Management Assistant N4", "Public Management N4"] },
        { name: "Engineering Studies", courses: ["Electrical Engineering N4", "Mechanical Engineering N4", "Civil Engineering N4"] },
        { name: "Occupational Programmes", courses: ["Hospitality Services", "Office Administration", "Generic Management"] }
      ]
    },
    {
      id: "uct",
      name: "University of Cape Town",
      shortName: "UCT",
      province: "Western Cape",
      type: "University",
      logo: "images/logos/uct.png",
      applicationDeadline: "2026-07-31",
      faculties: [
        { name: "Humanities", courses: ["Law", "Psychology", "Media Studies"] },
        { name: "Science", courses: ["Computer Science", "Mathematics", "Statistics"] },
        { name: "Health Sciences", courses: ["Medicine", "Audiology", "Nursing"] }
      ]
    },
    {
      id: "uwc",
      name: "University of the Western Cape",
      shortName: "UWC",
      province: "Western Cape",
      type: "University",
      logo: "images/logos/uwc.png",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Community and Health Sciences", courses: ["Nursing", "Social Work", "Public Health"] },
        { name: "Arts and Humanities", courses: ["Psychology", "History", "Language and Communication"] },
        { name: "Natural Sciences", courses: ["Biotechnology", "Computer Science", "Mathematics"] }
      ]
    },
    {
      id: "cput",
      name: "Cape Peninsula University of Technology",
      shortName: "CPUT",
      province: "Western Cape",
      type: "University of Technology",
      logo: "",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Applied Sciences", courses: ["Food Technology", "Biotechnology", "Environmental Health"] },
        { name: "Business and Management Sciences", courses: ["Marketing", "Hospitality Management", "Retail Business Management"] },
        { name: "Engineering", courses: ["Civil Engineering", "Chemical Engineering", "Mechanical Engineering"] }
      ]
    },
    {
      id: "false-bay",
      name: "False Bay TVET College",
      shortName: "False Bay TVET",
      province: "Western Cape",
      type: "TVET",
      logo: "",
      applicationDeadline: "2026-11-30",
      faculties: [
        { name: "Business Studies", courses: ["Business Management N4", "Hospitality N4", "Tourism N4"] },
        { name: "Engineering Studies", courses: ["Electrical Engineering N4", "Mechanical Engineering N4", "Civil Engineering N4"] },
        { name: "Maritime and Safety", courses: ["Boat Building", "Safety in Society", "Travel and Tourism"] }
      ]
    },
    {
      id: "sun",
      name: "Stellenbosch University",
      shortName: "SU",
      province: "Western Cape",
      type: "University",
      logo: "images/logos/sun.png",
      applicationDeadline: "2026-07-31",
      faculties: [
        { name: "Engineering", courses: ["Industrial Engineering", "Electrical Engineering", "Civil Engineering"] },
        { name: "Economic and Management Sciences", courses: ["BCom Management", "Investment Management", "Economics"] },
        { name: "AgriSciences", courses: ["Viticulture", "Agricultural Economics", "Food Science"] }
      ]
    },
    {
      id: "ufs",
      name: "University of the Free State",
      shortName: "UFS",
      province: "Free State",
      type: "University",
      logo: "images/logos/ufs.png",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Education", courses: ["BEd Foundation Phase", "BEd Intermediate Phase", "Sports Science"] },
        { name: "Natural and Agricultural Sciences", courses: ["Computer Science", "Agronomy", "Geology"] },
        { name: "Economic and Management Sciences", courses: ["Accounting", "Business Management", "Economics"] }
      ]
    },
    {
      id: "cut",
      name: "Central University of Technology",
      shortName: "CUT",
      province: "Free State",
      type: "University of Technology",
      logo: "",
      applicationDeadline: "2026-10-31",
      faculties: [
        { name: "Engineering, Built Environment and IT", courses: ["Information Technology", "Civil Engineering", "Architecture"] },
        { name: "Health and Environmental Sciences", courses: ["Biomedical Technology", "Clinical Technology", "Environmental Health"] },
        { name: "Management Sciences", courses: ["Human Resource Management", "Hospitality Management", "Marketing"] }
      ]
    },
    {
      id: "nwu",
      name: "North-West University",
      shortName: "NWU",
      province: "North West",
      type: "University",
      logo: "images/logos/nwu.png",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Economic and Management Sciences", courses: ["Accounting", "Business Analytics", "Economics"] },
        { name: "Engineering", courses: ["Mechanical Engineering", "Electronic Engineering", "Industrial Engineering"] },
        { name: "Health Sciences", courses: ["Nursing", "Biokinetics", "Pharmacy"] }
      ]
    },
    {
      id: "nmu",
      name: "Nelson Mandela University",
      shortName: "NMU",
      province: "Eastern Cape",
      type: "University",
      logo: "",
      applicationDeadline: "2026-09-30",
      faculties: [
        { name: "Business and Economic Sciences", courses: ["Accounting", "Marketing", "Economics"] },
        { name: "Science", courses: ["Computer Science", "Mathematics", "Environmental Science"] },
        { name: "Education", courses: ["BEd", "Foundation Phase Teaching", "Further Education and Training"] }
      ]
    },
    {
      id: "wsu",
      name: "Walter Sisulu University",
      shortName: "WSU",
      province: "Eastern Cape",
      type: "University",
      logo: "",
      applicationDeadline: "2026-10-31",
      faculties: [
        { name: "Engineering, Built Environment and IT", courses: ["Information Technology", "Civil Engineering", "Quantity Surveying"] },
        { name: "Education", courses: ["BEd Foundation Phase", "BEd Senior Phase", "Educational Leadership"] },
        { name: "Management Sciences", courses: ["Human Resource Management", "Public Management", "Accounting"] }
      ]
    },
    {
      id: "vhembe",
      name: "Vhembe TVET College",
      shortName: "Vhembe TVET",
      province: "Limpopo",
      type: "TVET",
      logo: "",
      applicationDeadline: "2026-11-30",
      faculties: [
        { name: "Business Studies", courses: ["Management Assistant N4", "Financial Management N4", "Public Management N4"] },
        { name: "Engineering Studies", courses: ["Electrical Engineering N4", "Mechanical Engineering N4", "Civil Engineering N4"] },
        { name: "Utility Studies", courses: ["Hospitality", "Tourism", "Office Administration"] }
      ]
    }
  ];

  const institutions = rawInstitutions.map(normalizeInstitutionRecord);

  const prospectus = institutions.map((institution) => ({
    id: institution.id,
    institution: institution.name,
    shortName: institution.shortName,
    province: institution.province,
    type: institution.type,
    year: institution.year,
    logo: institution.logo,
    summary: `${institution.name} offers ${institution.faculties.length} major study areas through Kagie's curated prospectus guide.`,
    applicationDeadline: institution.applicationDeadline,
    status: institution.status
  }));

  const updates = [
    {
      id: "upd_1",
      category: "announcement",
      title: "Kagie supports both universities and TVET colleges",
      body: "Use one profile to apply across multiple South African tertiary pathways without retyping your details.",
      ctaLabel: "Start applying",
      ctaHref: "forms.html"
    },
    {
      id: "upd_2",
      category: "recommendation",
      title: "Strong Maths and Science learners should widen their engineering shortlist",
      body: "If your Physical Sciences and Mathematics marks are strong, add a mix of universities and universities of technology for better options.",
      ctaLabel: "Review recommendations",
      ctaHref: "recommendation.html"
    },
    {
      id: "upd_3",
      category: "deadline",
      title: "Early deadline institutions open and close sooner",
      body: "UCT, Stellenbosch, and UP typically move earlier in the cycle, so submit those choices as soon as your pack is ready.",
      ctaLabel: "Open Kagie home",
      ctaHref: "home.html"
    },
    {
      id: "upd_4",
      category: "service",
      title: "More Service support is ready inside Kagie",
      body: "Add change email, forgot PIN, forgot student number, and re-apply support directly to your cart.",
      ctaLabel: "Open services",
      ctaHref: "more-service/index.html"
    }
  ];

  function groupInstitutionsForLegacy(records) {
    return records.reduce((acc, institution) => {
      acc[institution.province] = acc[institution.province] || {};
      acc[institution.province][institution.type] = acc[institution.province][institution.type] || {};
      acc[institution.province][institution.type][institution.name] = institution.faculties.reduce((facAcc, faculty) => {
        facAcc[faculty.name] = faculty.courses.slice();
        return facAcc;
      }, {});
      return acc;
    }, {});
  }

  window.KagieData = {
    provinces,
    homeLanguages,
    genders,
    schoolTypes,
    dbeSubjects,
    applicationPacks,
    extraServices,
    accommodationListings,
    transportOptions,
    institutions,
    prospectus,
    updates
  };

  window.KAGIE_PACKS = applicationPacks;
  window.KAGIE_SERVICES = extraServices;
  window.KAGIE_ACCOMMODATION = accommodationListings;
  window.KAGIE_TRANSPORT = transportOptions;
  window.KAGIE_INSTITUTIONS = institutions.map((institution) => ({
    province: institution.province,
    name: institution.name,
    type: institution.type,
    faculties: institution.faculties.map((faculty) => ({
      name: faculty.name,
      courses: faculty.courses.slice()
    }))
  }));
  window.KAGIE_INSTITUTIONS_GROUPED = groupInstitutionsForLegacy(institutions);
})();
