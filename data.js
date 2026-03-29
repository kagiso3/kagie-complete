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
      name: "10 Institution Pack",
      price: 250,
      institutionLimit: 10,
      highlight: "Best value for a strong first shortlist",
      description: "Apply to up to 10 institutions with guided form completion, shortlist support, and Kagie tracking in one place."
    },
    {
      id: "growth",
      name: "15 Institution Pack",
      price: 350,
      institutionLimit: 15,
      highlight: "Balanced choice for wider national coverage",
      description: "Apply to up to 15 universities, colleges, and TVET institutions while keeping your draft, documents, and support aligned."
    },
    {
      id: "premium",
      name: "20 Institution Pack",
      price: 450,
      institutionLimit: 20,
      highlight: "Built for ambitious applicants targeting many options",
      description: "Apply to up to 20 institutions with broader coverage, stronger planning room, and premium Kagie guidance."
    },
    {
      id: "concierge",
      name: "Unlimited Pack",
      price: 800,
      institutionLimit: "unlimited",
      highlight: "Maximum reach with full Kagie support",
      description: "Apply to as many institutions as you need with unlimited shortlist coverage and close Kagie support across the cycle."
    }
  ];

  const extraServices = [
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

  const institutions = [
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

  const prospectus = institutions.map((institution) => ({
    id: institution.id,
    institution: institution.name,
    shortName: institution.shortName,
    province: institution.province,
    type: institution.type,
    year: "2026",
    logo: institution.logo,
    summary: `${institution.name} offers ${institution.faculties.length} major study areas through Kagie's curated prospectus guide.`,
    applicationDeadline: institution.applicationDeadline
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
      ctaLabel: "Open dashboard",
      ctaHref: "Dashboard.html"
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
    institutions,
    prospectus,
    updates
  };

  window.KAGIE_PACKS = applicationPacks;
  window.KAGIE_SERVICES = extraServices;
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
