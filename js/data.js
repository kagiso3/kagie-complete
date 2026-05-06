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
    "Sepulana",
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
      description: "Browse housing, compare rooms, and send a reservation request."
    },
    {
      id: "transport_assist",
      name: "Transport Assist",
      slug: "transport-assist",
      price: 0,
      pricingLabel: "Support on request",
      description: "Kagie sends learner transport tickets straight into the account."
    },
    {
      id: "funding_assist",
      name: "Funding Assist",
      slug: "funding-assist",
      price: 220,
      description: "Get bursary and funding checklist help."
    },
    {
      id: "change_email",
      name: "Change Email",
      slug: "change-email",
      price: 50,
      description: "Update the email linked to your student portal."
    },
    {
      id: "re_apply",
      name: "Re-Apply Help",
      slug: "re-apply",
      price: 50,
      description: "Get help with a fresh or corrective application."
    },
    {
      id: "forgot_pin",
      name: "Forgot PIN",
      slug: "forgot-pin",
      price: 10,
      description: "Recover or reset your portal PIN."
    },
    {
      id: "forgot_student_number",
      name: "Forgot Student Number",
      slug: "forgot-student-number",
      price: 10,
      description: "Recover your student number."
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
      address: "12 Ridge Road, Berea, Durban",
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
      address: "45 Kingsway Avenue, Auckland Park, Johannesburg",
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
      address: "88 Burnett Street, Hatfield, Pretoria",
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
      address: "17 Belmont Road, Rondebosch, Cape Town",
      price: 6200,
      roomType: "Single room",
      availabilityStatus: "Waitlist",
      distanceFromCampus: "1.4 km from upper campus",
      images: [buildSceneArtwork("Table Mountain House", "#6d7ef8", "#3852d5", "#f5c84c")],
      description: "Premium private rooms with mountain-facing common areas and controlled visitor access.",
      contactPhone: "021 555 8800"
    }
  ];

  const transportNetworkCities = [
    { city: "Johannesburg", province: "Gauteng", x: 61, y: 38, hub: true, campus: "Wits, UJ, Rosebank and Braamfontein study hub" },
    { city: "Pretoria", province: "Gauteng", x: 64, y: 35, hub: true, campus: "UP, TUT and Hatfield study hub" },
    { city: "Benoni", province: "Gauteng", x: 63, y: 38, hub: false, campus: "East Rand departure lane" },
    { city: "Soweto", province: "Gauteng", x: 59, y: 40, hub: false, campus: "South west Gauteng connector" },
    { city: "Germiston", province: "Gauteng", x: 62, y: 39, hub: false, campus: "Ekurhuleni transfer lane" },
    { city: "Roodepoort", province: "Gauteng", x: 58, y: 39, hub: false, campus: "West Rand departure lane" },
    { city: "Vereeniging", province: "Gauteng", x: 58, y: 44, hub: false, campus: "Vaal triangle connector" },
    { city: "Vanderbijlpark", province: "Gauteng", x: 57, y: 43, hub: false, campus: "VUT and Sedibeng study lane" },
    { city: "Durban", province: "KwaZulu-Natal", x: 77, y: 59, hub: true, campus: "DUT, UKZN and coastal move-in hub" },
    { city: "Pietermaritzburg", province: "KwaZulu-Natal", x: 73, y: 53, hub: true, campus: "UKZN PMB and Midlands study hub" },
    { city: "Richards Bay", province: "KwaZulu-Natal", x: 83, y: 49, hub: false, campus: "North coast connector" },
    { city: "Port Shepstone", province: "KwaZulu-Natal", x: 78, y: 66, hub: false, campus: "South coast connector" },
    { city: "Kokstad", province: "KwaZulu-Natal", x: 67, y: 58, hub: false, campus: "Southern KZN connector" },
    { city: "Ladysmith", province: "KwaZulu-Natal", x: 69, y: 48, hub: false, campus: "Northern KZN connector" },
    { city: "Newcastle", province: "KwaZulu-Natal", x: 72, y: 41, hub: false, campus: "Amajuba connector" },
    { city: "Cape Town", province: "Western Cape", x: 18, y: 86, hub: true, campus: "UCT, CPUT and city campus hub" },
    { city: "Bellville", province: "Western Cape", x: 20, y: 84, hub: false, campus: "Cape Peninsula connector" },
    { city: "Stellenbosch", province: "Western Cape", x: 24, y: 82, hub: true, campus: "SU and Winelands study hub" },
    { city: "Paarl", province: "Western Cape", x: 22, y: 80, hub: false, campus: "Boland connector" },
    { city: "Worcester", province: "Western Cape", x: 24, y: 78, hub: false, campus: "Cape winelands connector" },
    { city: "George", province: "Western Cape", x: 38, y: 72, hub: false, campus: "Garden Route connector" },
    { city: "Mossel Bay", province: "Western Cape", x: 35, y: 74, hub: false, campus: "Garden Route coastal connector" },
    { city: "Gqeberha", province: "Eastern Cape", x: 55, y: 71, hub: true, campus: "NMU and coastal TVET hub" },
    { city: "East London", province: "Eastern Cape", x: 64, y: 62, hub: true, campus: "Buffalo City study hub" },
    { city: "Mthatha", province: "Eastern Cape", x: 67, y: 55, hub: true, campus: "WSU and inland Eastern Cape hub" },
    { city: "Butterworth", province: "Eastern Cape", x: 65, y: 58, hub: false, campus: "Transkei connector" },
    { city: "Komani", province: "Eastern Cape", x: 58, y: 58, hub: false, campus: "Queenstown corridor connector" },
    { city: "Graaff-Reinet", province: "Eastern Cape", x: 49, y: 64, hub: false, campus: "Karoo connector" },
    { city: "Bloemfontein", province: "Free State", x: 49, y: 50, hub: true, campus: "UFS and central study hub" },
    { city: "Welkom", province: "Free State", x: 50, y: 44, hub: false, campus: "Goldfields connector" },
    { city: "Bethlehem", province: "Free State", x: 57, y: 48, hub: false, campus: "Eastern Free State connector" },
    { city: "Harrismith", province: "Free State", x: 60, y: 47, hub: false, campus: "N3 connector" },
    { city: "Kroonstad", province: "Free State", x: 54, y: 45, hub: false, campus: "N1 central connector" },
    { city: "Polokwane", province: "Limpopo", x: 62, y: 23, hub: true, campus: "UL and Capricorn study hub" },
    { city: "Makhado", province: "Limpopo", x: 64, y: 16, hub: false, campus: "Far north connector" },
    { city: "Thohoyandou", province: "Limpopo", x: 68, y: 18, hub: true, campus: "UNIVEN study hub" },
    { city: "Tzaneen", province: "Limpopo", x: 67, y: 24, hub: false, campus: "Mopani connector" },
    { city: "Burgersfort", province: "Limpopo", x: 68, y: 28, hub: false, campus: "Sekhukhune connector" },
    { city: "Lephalale", province: "Limpopo", x: 54, y: 21, hub: false, campus: "Waterberg connector" },
    { city: "Mbombela", province: "Mpumalanga", x: 74, y: 33, hub: true, campus: "Lowveld study hub" },
    { city: "Emalahleni", province: "Mpumalanga", x: 66, y: 35, hub: false, campus: "Highveld connector" },
    { city: "Middelburg", province: "Mpumalanga", x: 68, y: 34, hub: false, campus: "Nkangala connector" },
    { city: "Ermelo", province: "Mpumalanga", x: 69, y: 39, hub: false, campus: "Eastern Highveld connector" },
    { city: "Secunda", province: "Mpumalanga", x: 67, y: 41, hub: false, campus: "Energy belt connector" },
    { city: "Mahikeng", province: "North West", x: 44, y: 33, hub: true, campus: "NWU Mahikeng hub" },
    { city: "Rustenburg", province: "North West", x: 53, y: 34, hub: false, campus: "Bojanala connector" },
    { city: "Potchefstroom", province: "North West", x: 51, y: 39, hub: true, campus: "NWU Potchefstroom hub" },
    { city: "Klerksdorp", province: "North West", x: 49, y: 37, hub: false, campus: "Matlosana connector" },
    { city: "Kimberley", province: "Northern Cape", x: 39, y: 54, hub: true, campus: "Sol Plaatje and central NC hub" },
    { city: "De Aar", province: "Northern Cape", x: 36, y: 58, hub: false, campus: "National rail and coach connector" },
    { city: "Upington", province: "Northern Cape", x: 25, y: 48, hub: false, campus: "Kalahari connector" },
    { city: "Kuruman", province: "Northern Cape", x: 34, y: 43, hub: false, campus: "Northern Cape mining belt connector" },
    { city: "Springbok", province: "Northern Cape", x: 15, y: 54, hub: false, campus: "Namaqualand connector" }
  ];

  const transportOperators = [
    { name: "Intercape Mainliner", luggage: "2 suitcases + hand luggage" },
    { name: "City to City", luggage: "Standard coach luggage policy" },
    { name: "Eagle Liner Transport", luggage: "1 large suitcase + 1 hand bag" },
    { name: "Intercity Xpress", luggage: "2 bags included" },
    { name: "Citiliner Plus", luggage: "1 suitcase + 1 hand bag" },
    { name: "Translux", luggage: "2 suitcases + hand luggage" },
    { name: "African People Mover", luggage: "1 suitcase + 1 backpack" },
    { name: "Campus Connect", luggage: "Student luggage allowance" }
  ];

  function slugifyTransportValue(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function formatTransportDuration(hoursValue) {
    const totalMinutes = Math.max(135, Math.round(Number(hoursValue || 0) * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  function formatTransportClock(totalMinutesValue) {
    const minutes = ((Math.round(Number(totalMinutesValue || 0)) % 1440) + 1440) % 1440;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  function buildTransportDescription(origin, destination, durationHours) {
    const tripType = origin.province === destination.province ? "province-to-campus" : "interprovincial";
    if (destination.hub && tripType === "interprovincial") {
      return `Nationwide student route from ${origin.city} into the ${destination.campus}, useful for applications, move-in, and registration support.`;
    }
    if (destination.hub) {
      return `Student route from ${origin.city} into the ${destination.campus}, helpful for day trips, documents, and campus follow-up.`;
    }
    if (durationHours >= 10) {
      return `Long-haul coach support between ${origin.city} and ${destination.city}, suitable for semester travel, residence move-ins, and holiday return trips.`;
    }
    return `Flexible student travel route between ${origin.city} and ${destination.city} for campus support, family travel, and admin follow-up days.`;
  }

  function buildSouthAfricaTransportOptions() {
    const routes = [];

    transportNetworkCities.forEach((origin, originIndex) => {
      transportNetworkCities.forEach((destination, destinationIndex) => {
        if (origin.city === destination.city) return;

        const dx = destination.x - origin.x;
        const dy = destination.y - origin.y;
        const distanceUnits = Math.sqrt((dx * dx) + (dy * dy));
        const sameProvince = origin.province === destination.province;
        const tripBias = origin.hub || destination.hub ? 0.45 : 0.95;
        const durationHours = Number(Math.max(sameProvince ? 2.4 : 3.8, (distanceUnits / 3.25) + tripBias).toFixed(1));
        const hashedIndex = ((originIndex + 3) * 17 + (destinationIndex + 5) * 11) % transportOperators.length;
        const operator = transportOperators[hashedIndex];
        const departureWindow = durationHours >= 9 ? 17 * 60 : durationHours >= 5 ? 7 * 60 : 6 * 60 + 30;
        const departureMinutes = departureWindow + ((((originIndex * 23) + (destinationIndex * 17)) % 6) * 25);
        const arrivalMinutes = departureMinutes + Math.round(durationHours * 60);
        const estimatedPrice = Math.max(
          sameProvince ? 170 : 250,
          Math.round(((distanceUnits * 22) + (durationHours * 26) + (destination.hub ? 40 : 10)) / 10) * 10
        );
        const supportFee = Math.round((Math.min(95, 38 + (durationHours * 3.4))) / 5) * 5;
        const bookingStatus = ((originIndex + destinationIndex) % 9 === 0) ? "Limited" : "Available";
        const travelDateLabel = durationHours >= 10 ? "Daily overnight" : sameProvince ? "Daily service" : (((originIndex + destinationIndex) % 3 === 0) ? "Daily service" : "Daily + weekend");

        routes.push({
          id: `trans_${slugifyTransportValue(origin.city)}_${slugifyTransportValue(destination.city)}_${slugifyTransportValue(operator.name)}`,
          company: operator.name,
          departureCity: origin.city,
          destinationCity: destination.city,
          departureProvince: origin.province,
          destinationProvince: destination.province,
          departureTime: formatTransportClock(departureMinutes),
          arrivalTime: formatTransportClock(arrivalMinutes),
          travelDateLabel,
          routeType: sameProvince ? "Regional coach" : "Intercity coach",
          estimatedPrice,
          supportFee,
          duration: formatTransportDuration(durationHours),
          luggage: operator.luggage,
          bookingStatus,
          description: buildTransportDescription(origin, destination, durationHours)
        });
      });
    });

    return routes.sort((a, b) =>
      String(a.departureCity).localeCompare(String(b.departureCity))
      || String(a.destinationCity).localeCompare(String(b.destinationCity))
      || Number(a.estimatedPrice || 0) - Number(b.estimatedPrice || 0)
    );
  }

  const transportOptions = buildSouthAfricaTransportOptions();

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

  function formatInstitutionFee(value) {
    return `R${Number(value || 0).toLocaleString("en-ZA")}`;
  }

  function defaultInstitutionApplicationFee(record) {
    const type = String(record?.type || record?.institutionType || "").trim().toLowerCase();
    const name = String(record?.name || "").trim().toLowerCase();
    if (!type && !name) return 0;
    if (type === "tvet" || /tvet/.test(name)) return 0;
    if (/cape town|stellenbosch|witwatersrand|wits|pretoria/.test(name)) return 100;
    if (/johannesburg|ukzn|kwazulu-natal|western cape|ufs|free state|nelson mandela|north-west|walter sisulu/.test(name)) return 200;
    if (/tshwane university of technology|durban university of technology|mangosuthu/.test(name)) return 240;
    if (/unisa|south africa/.test(name)) return 140;
    if (type === "university of technology") return 240;
    if (type === "university") return 200;
    return 0;
  }

  function uniqueStrings(items) {
    return [...new Set((Array.isArray(items) ? items : []).map((item) => String(item || "").trim()).filter(Boolean))];
  }

  function inferFacultySummary(name, courses) {
    const label = String(name || "").trim().toLowerCase();
    const count = uniqueStrings(courses).length;
    if (/engineering|built environment|architecture|survey/.test(label)) {
      return `Strong for learners who enjoy maths, science, design, and practical problem-solving across ${count} guided courses.`;
    }
    if (/health|medicine|nursing|clinical|pharmacy|public health|dental/.test(label)) {
      return `Built for health-focused learners who want people-centred study paths, science depth, and professional career options across ${count} guided courses.`;
    }
    if (/education|teaching/.test(label)) {
      return `Designed for future teachers, education specialists, and learner-support careers with ${count} guided study choices.`;
    }
    if (/business|management|commerce|economic|accounting|informatics|ict/.test(label)) {
      return `Good for commerce, business, finance, admin, and digital-office pathways with ${count} guided course options.`;
    }
    if (/science|technology|it|computer|informatics|natural sciences|applied sciences/.test(label)) {
      return `Suitable for analytical learners who like technology, research, systems, and science-based careers through ${count} guided options.`;
    }
    if (/humanities|arts|human sciences|social work|psychology|law|communication/.test(label)) {
      return `A flexible pathway for people-focused, communication, law, and social-impact careers with ${count} guided courses.`;
    }
    if (/agri|agriculture|environmental/.test(label)) {
      return `A practical route into agriculture, environmental systems, and community-impact work with ${count} guided courses.`;
    }
    return `This faculty gives Kagie learners ${count} guided course options to compare before applying.`;
  }

  function inferCourseFocus(course) {
    const label = String(course || "").trim().toLowerCase();
    if (/engineering|mechanical|electrical|civil|chemical|industrial/.test(label)) return "Maths and science intensive";
    if (/accounting|economics|business|management|marketing|auditing|public management/.test(label)) return "Business and commerce pathway";
    if (/nursing|medicine|pharmacy|physio|dent|clinical|public health/.test(label)) return "Health and care pathway";
    if (/computer|information|informatics|systems|multimedia|it\b/.test(label)) return "Digital and technology pathway";
    if (/education|teaching|foundation phase|senior phase/.test(label)) return "Teaching and learner development";
    if (/law|psychology|social work|media|journalism|communication|history|language/.test(label)) return "People, media, or society pathway";
    if (/agri|food|environment|biotech|biochemistry|science|mathematics|physics/.test(label)) return "Science and research pathway";
    return "Career-focused study option";
  }

  function enrichFacultyRecord(faculty) {
    const courses = uniqueStrings(faculty?.courses);
    return {
      ...faculty,
      name: String(faculty?.name || "").trim(),
      courses,
      courseCount: courses.length,
      featuredCourses: courses.slice(0, 4),
      summary: String(faculty?.summary || "").trim() || inferFacultySummary(faculty?.name, courses),
      focusTags: uniqueStrings(courses.map((course) => inferCourseFocus(course))).slice(0, 3)
    };
  }

  function buildInstitutionStudyOverview(faculties) {
    const list = Array.isArray(faculties) ? faculties : [];
    const facultyCount = list.length;
    const courseCount = list.reduce((sum, faculty) => sum + Number(faculty?.courseCount || uniqueStrings(faculty?.courses).length || 0), 0);
    return {
      facultyCount,
      courseCount,
      studyOverview: facultyCount
        ? `${facultyCount} guided faculties and ${courseCount} visible course options are ready in Kagie for comparison.`
        : "Kagie is still waiting for the richer faculty and course catalogue for this institution."
    };
  }

  function normalizeInstitutionRecord(record) {
    const year = String(record.year || record.applicationDeadline?.slice(0, 4) || new Date().getFullYear());
    const closingDate = String(record.closingDate || record.closing_date || record.applicationDeadline || "").trim();
    const openingDate = String(record.openingDate || record.opening_date || `${year}-01-15`).trim();
    const isActive = record.isActive !== false && record.is_active !== false;
    const numericFee = Number(record.applicationFee ?? record.application_fee ?? record.fee ?? record.feeAmount ?? 0);
    const applicationFee = Number.isFinite(numericFee) ? Math.max(0, numericFee) : defaultInstitutionApplicationFee(record);
    const enrichedFaculties = (Array.isArray(record.faculties) ? record.faculties : []).map(enrichFacultyRecord).filter((faculty) => faculty.name);
    const studyMeta = buildInstitutionStudyOverview(enrichedFaculties);
    const normalized = {
      ...record,
      faculties: enrichedFaculties,
      facultyCount: studyMeta.facultyCount,
      courseCount: studyMeta.courseCount,
      studyOverview: String(record.studyOverview || "").trim() || studyMeta.studyOverview,
      year,
      applicationFee,
      application_fee: applicationFee,
      applicationFeeLabel: String(record.applicationFeeLabel || record.application_fee_label || (applicationFee > 0 ? `Institution fee: ${formatInstitutionFee(applicationFee)}` : "Institution fee: Free")).trim(),
      applicationFeeNote: String(record.applicationFeeNote || record.application_fee_note || (applicationFee > 0 ? "This fee is charged by the institution, not by Kagie. It may change by programme or intake." : "This institution may not charge an application fee. That is separate from Kagie pricing.")).trim(),
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

  function institutionDedupeKey(record) {
    const name = String(record?.name || record?.institution || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.,'"]/g, "")
      .toLowerCase();
    return name || "";
  }

  function mergeInstitutionFaculties(primary, duplicate) {
    const byName = new Map();
    [primary, duplicate].forEach((record) => {
      (Array.isArray(record?.faculties) ? record.faculties : []).forEach((faculty) => {
        const name = String(faculty?.name || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        const existing = byName.get(key) || { ...faculty, courses: [] };
        const courses = uniqueStrings([...(existing.courses || []), ...(faculty.courses || [])]);
        byName.set(key, {
          ...existing,
          ...faculty,
          name,
          courses,
          courseCount: Math.max(Number(existing.courseCount || 0), Number(faculty.courseCount || 0), courses.length)
        });
      });
    });
    return Array.from(byName.values());
  }

  function dedupeInstitutionRecords(records) {
    const byKey = new Map();
    (Array.isArray(records) ? records : []).forEach((record) => {
      const key = institutionDedupeKey(record);
      if (!key) return;
      const current = byKey.get(key);
      if (!current) {
        byKey.set(key, record);
        return;
      }
      const preferred = (record.status === "open" && current.status !== "open") || (record.faculties || []).length > (current.faculties || []).length
        ? record
        : current;
      const secondary = preferred === record ? current : record;
      const faculties = mergeInstitutionFaculties(preferred, secondary);
      byKey.set(key, normalizeInstitutionRecord({
        ...secondary,
        ...preferred,
        faculties,
        facultyCount: faculties.length,
        courseCount: faculties.reduce((sum, faculty) => sum + Number(faculty.courseCount || (faculty.courses || []).length || 0), 0)
      }));
    });
    return Array.from(byKey.values());
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

  const institutions = dedupeInstitutionRecords(rawInstitutions.map(normalizeInstitutionRecord));

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

  const pastPaperGrades = ["Grade 12", "Grade 11", "Grade 10", "Grade 9", "Grade 8"];
  const pastPaperYearOptions = [2026, 2025, 2024, 2023, 2022];
  const commonPastPaperSubjects = dbeSubjects.slice();
  const pastPaperSubjectMap = pastPaperGrades.reduce((acc, grade) => {
    acc[grade] = commonPastPaperSubjects.slice();
    return acc;
  }, {});

  const pastPaperSessions = [
    {
      id: "jan_feb",
      label: "Jan/Feb",
      description: "Start the year with a baseline paper and catch weak spots early.",
      paperNumbers: ["paper_1", "paper_2", "paper_1_memo", "paper_2_memo"]
    },
    {
      id: "may_june",
      label: "May/June",
      description: "Mid-year exam papers for serious revision and timing practice.",
      paperNumbers: ["paper_1", "paper_2", "paper_1_memo", "paper_2_memo"]
    },
    {
      id: "sept_oct",
      label: "Sept/Oct",
      description: "Pre-final revision papers to sharpen recall and confidence.",
      paperNumbers: ["paper_1", "paper_2", "paper_1_memo", "paper_2_memo"]
    },
    {
      id: "nov_dec",
      label: "Nov/Dec",
      description: "Final exam paper cycle for full-pressure practice.",
      paperNumbers: ["paper_1", "paper_2", "paper_1_memo", "paper_2_memo"]
    },
    {
      id: "learner_guides",
      label: "Learner Guides",
      description: "Study support files, exemplars, and learner-friendly revision guides.",
      paperNumbers: ["guide"]
    }
  ];

  const pastPaperPaperNumbers = {
    paper_1: { id: "paper_1", label: "Paper 1" },
    paper_2: { id: "paper_2", label: "Paper 2" },
    paper_1_memo: { id: "paper_1_memo", label: "Paper 1 Memo" },
    paper_2_memo: { id: "paper_2_memo", label: "Paper 2 Memo" },
    guide: { id: "guide", label: "Learner Guide" }
  };

  const pastPaperBlueprint = {
    grades: pastPaperGrades.slice(),
    years: pastPaperYearOptions.slice(),
    provinces: provinces.slice(),
    subjectsByGrade: JSON.parse(JSON.stringify(pastPaperSubjectMap)),
    sessions: JSON.parse(JSON.stringify(pastPaperSessions)),
    paperNumbers: JSON.parse(JSON.stringify(pastPaperPaperNumbers))
  };

  const pastPapers = [];

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
    updates,
    pastPapers,
    pastPaperBlueprint
  };

  window.KAGIE_PACKS = applicationPacks;
  window.KAGIE_SERVICES = extraServices;
  window.KAGIE_ACCOMMODATION = accommodationListings;
  window.KAGIE_TRANSPORT = transportOptions;
  window.KAGIE_PAST_PAPER_BLUEPRINT = pastPaperBlueprint;
  window.KAGIE_PAST_PAPERS = pastPapers;
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
