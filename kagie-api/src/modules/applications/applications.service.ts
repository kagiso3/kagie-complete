import { randomUUID } from "node:crypto";
import type {
  ApplicationFormsSnapshot,
  ApplicationMark,
  ApplicationPack,
  ApplicationRecord,
  CallbackRequestRecord,
  InstitutionChoice,
  NotificationRecord,
  PaymentRecord,
  SupportMessageRecord,
  SupportThreadRecord,
  UserRecord
} from "@kagie/shared";
import {
  APPLICATION_STATUSES,
  CALLBACK_STATUSES,
  PAYMENT_STATUSES,
  ROLES,
  SOUTH_AFRICAN_PROVINCES
} from "@kagie/shared";
import { getSupabaseAdminClient, mapSupabaseProfileToUserRecord, type RemoteProfile } from "../../lib/supabase";

type ApplicationSection = "learner" | "parent" | "school";

type CatalogInstitution = {
  id: string;
  name: string;
  shortName?: string;
  province: string;
  type: string;
  year?: string;
  openingDate?: string;
  applicationDeadline: string;
  closingDate?: string;
  status?: "open" | "closing_soon" | "closed";
  manualStatus?: "open" | "closing_soon" | "closed" | "";
  isActive?: boolean;
  faculties: Array<{
    name: string;
    courses: string[];
  }>;
};

type CheckoutPayload = {
  payerName: string;
  phone: string;
  reference: string;
  method: PaymentRecord["method"];
  note?: string;
};

type ExtraService = {
  id: string;
  name: string;
  slug: string;
  price: number;
  description: string;
};

type UpdateCard = {
  id: string;
  category: "announcement" | "recommendation" | "deadline" | "service";
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

type RemoteUserProfile = {
  user_id: string;
  id_number?: string | null;
  surname?: string | null;
  maiden_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  home_language?: string | null;
  province?: string | null;
  postal_code?: string | null;
  address?: string | null;
};

type RemoteGuardianProfile = {
  user_id: string;
  relation?: string | null;
  guardian_id?: string | null;
  full_names?: string | null;
  surname?: string | null;
  phone_1?: string | null;
  phone_2?: string | null;
  email?: string | null;
  province?: string | null;
  postal_code?: string | null;
  address?: string | null;
};

type RemoteSchoolProfile = {
  user_id: string;
  school_name?: string | null;
  confirm_name?: string | null;
  school_province?: string | null;
  school_type?: string | null;
  completion_year?: number | null;
  average?: number | string | null;
};

type RemoteApplicationPack = {
  id: string;
  code?: string | null;
  name: string;
  price: number | string | null;
  institution_limit?: number | null;
  is_unlimited?: boolean | null;
  description?: string | null;
  highlight?: string | null;
  is_active?: boolean | null;
};

type RemoteApplication = {
  id: string;
  user_id: string;
  assistant_id?: string | null;
  package_id?: string | null;
  status: ApplicationRecord["status"];
  payment_status: ApplicationRecord["paymentStatus"];
  payer_name?: string | null;
  payer_phone?: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
  payment_note?: string | null;
  payment_amount?: number | string | null;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
};

type RemoteApplicationMark = {
  id: string;
  application_id: string;
  subject: string;
  percent: number | string;
  level: number | string;
  created_at: string;
  updated_at: string;
};

type RemoteApplicationInstitution = {
  id: string;
  application_id: string;
  province: string;
  institution_type: string;
  institution_name: string;
  faculty: string;
  choice_1: string;
  choice_2: string;
  choice_3: string;
  created_at: string;
  updated_at: string;
};

type RemoteNotification = {
  id: string;
  user_id?: string | null;
  title: string;
  message: string;
  notification_type?: string | null;
  is_read?: boolean | null;
  created_at: string;
  updated_at: string;
};

type RemoteSupportThread = {
  id: string;
  user_id: string;
  assistant_id?: string | null;
  status: SupportThreadRecord["status"];
  created_at: string;
  updated_at: string;
};

type RemoteSupportMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: SupportMessageRecord["senderRole"];
  message: string;
  created_at: string;
  updated_at: string;
};

type RemoteCallbackRequest = {
  id: string;
  user_id: string;
  assigned_assistant_id?: string | null;
  phone: string;
  preferred_time?: string | null;
  note?: string | null;
  status: CallbackRequestRecord["status"];
  created_at: string;
  updated_at: string;
};

const fallbackPacks: ApplicationPack[] = [
  {
    id: "launch",
    name: "10 Institution Pack",
    price: 250,
    institutionLimit: 10,
    description: "Apply to up to 10 institutions with guided form completion, shortlist support, and Kagie tracking in one place.",
    highlight: "Best value for a strong first shortlist"
  },
  {
    id: "growth",
    name: "15 Institution Pack",
    price: 350,
    institutionLimit: 15,
    description: "Apply to up to 15 universities, colleges, and TVET institutions while keeping your draft, documents, and support aligned.",
    highlight: "Balanced choice for wider national coverage"
  },
  {
    id: "premium",
    name: "20 Institution Pack",
    price: 450,
    institutionLimit: 20,
    description: "Apply to up to 20 institutions with broader coverage, stronger planning room, and premium Kagie guidance.",
    highlight: "Built for ambitious applicants targeting many options"
  },
  {
    id: "concierge",
    name: "Unlimited Pack",
    price: 800,
    institutionLimit: "unlimited",
    description: "Apply to as many institutions as you need with unlimited shortlist coverage and close Kagie support across the cycle.",
    highlight: "Maximum reach with full Kagie support"
  }
];

const schoolTypes = ["Public", "Private", "Independent", "Combined", "TVET", "Adult Education"];
const homeLanguages = ["English", "isiZulu", "isiXhosa", "Sesotho", "Setswana", "Xitsonga", "Tshivenda", "Afrikaans", "Sepedi", "isiNdebele", "Siswati"];
const subjects = [
  "Accounting",
  "Agricultural Sciences",
  "Business Studies",
  "Computer Applications Technology",
  "Consumer Studies",
  "Dramatic Arts",
  "Economics",
  "Engineering Graphics and Design",
  "English First Additional Language",
  "English Home Language",
  "Geography",
  "History",
  "Information Technology",
  "isiZulu Home Language",
  "isiXhosa Home Language",
  "Life Orientation",
  "Life Sciences",
  "Mathematical Literacy",
  "Mathematics",
  "Physical Sciences",
  "Tourism",
  "Visual Arts"
];
const paymentMethods: PaymentRecord["method"][] = ["EFT", "Cash Deposit", "Card Transfer", "Mobile Payment"];
const extraServices: ExtraService[] = [
  {
    id: "change_email",
    name: "Change Email",
    slug: "change-email",
    price: 50,
    description: "Request Kagie assistance updating the email linked to your institution profile."
  },
  {
    id: "re_apply",
    name: "Re-Apply Help",
    slug: "re-apply",
    price: 50,
    description: "Get support for a corrective or follow-up application to the same institution."
  },
  {
    id: "forgot_pin",
    name: "Forgot PIN",
    slug: "forgot-pin",
    price: 10,
    description: "Recover or reset your institution PIN through Kagie guided support."
  },
  {
    id: "forgot_student_number",
    name: "Forgot Student Number",
    slug: "forgot-student-number",
    price: 10,
    description: "Recover your student number so you can continue with tracking and portal access."
  }
];
const updateCards: UpdateCard[] = [
  {
    id: "upd_1",
    category: "announcement",
    title: "Kagie supports universities and TVET colleges",
    body: "Use one profile to apply across multiple South African tertiary pathways without retyping your details.",
    ctaLabel: "Open Apply",
    ctaHref: "apply"
  },
  {
    id: "upd_2",
    category: "recommendation",
    title: "Strong Maths and Science learners should widen their engineering shortlist",
    body: "If your Physical Sciences and Mathematics marks are strong, mix universities and universities of technology for better coverage.",
    ctaLabel: "Review shortlist",
    ctaHref: "apply"
  },
  {
    id: "upd_3",
    category: "deadline",
    title: "Early deadline institutions move sooner",
    body: "UCT, Stellenbosch, and UP often close earlier in the cycle, so submit those choices as soon as your pack is ready.",
    ctaLabel: "Check cart",
    ctaHref: "cart"
  },
  {
    id: "upd_4",
    category: "service",
    title: "More Service support is live in Kagie mobile",
    body: "You can request change email, forgot PIN, forgot student number, and re-apply help from the mobile app too.",
    ctaLabel: "Open services",
    ctaHref: "explore"
  }
];

const seedInstitutionCatalog: CatalogInstitution[] = [
  {
    id: "uj",
    name: "University of Johannesburg",
    province: "Gauteng",
    type: "University",
    applicationDeadline: "2026-10-31",
    faculties: [
      { name: "Engineering and the Built Environment", courses: ["Electrical Engineering", "Industrial Engineering", "Architecture"] },
      { name: "Humanities", courses: ["Education", "Psychology", "Journalism"] },
      { name: "Management", courses: ["Accounting", "Marketing", "Human Resource Management"] }
    ]
  },
  {
    id: "up",
    name: "University of Pretoria",
    province: "Gauteng",
    type: "University",
    applicationDeadline: "2026-08-31",
    faculties: [
      { name: "Economic and Management Sciences", courses: ["BCom Accounting", "Economics", "Financial Sciences"] },
      { name: "Health Sciences", courses: ["Medicine", "Nursing", "Radiography"] },
      { name: "Engineering", courses: ["Civil Engineering", "Mechanical Engineering", "Mining Engineering"] }
    ]
  },
  {
    id: "dut",
    name: "Durban University of Technology",
    province: "KwaZulu-Natal",
    type: "University of Technology",
    applicationDeadline: "2026-09-30",
    faculties: [
      { name: "Accounting and Informatics", courses: ["Accounting", "Information Technology", "Internal Auditing"] },
      { name: "Management Sciences", courses: ["Marketing", "Operations Management", "Public Management"] },
      { name: "Engineering and the Built Environment", courses: ["Civil Engineering", "Electrical Engineering", "Construction Management"] }
    ]
  },
  {
    id: "ukzn",
    name: "University of KwaZulu-Natal",
    province: "KwaZulu-Natal",
    type: "University",
    applicationDeadline: "2026-09-30",
    faculties: [
      { name: "Health Sciences", courses: ["Medicine", "Nursing", "Pharmacy"] },
      { name: "Humanities", courses: ["Education", "Psychology", "Social Work"] },
      { name: "Engineering", courses: ["Civil Engineering", "Chemical Engineering", "Mechanical Engineering"] }
    ]
  },
  {
    id: "cput",
    name: "Cape Peninsula University of Technology",
    province: "Western Cape",
    type: "University of Technology",
    applicationDeadline: "2026-09-30",
    faculties: [
      { name: "Applied Sciences", courses: ["Biotechnology", "Food Technology", "Marine Science"] },
      { name: "Business and Management Sciences", courses: ["Hospitality Management", "Marketing", "Retail Business Management"] },
      { name: "Informatics and Design", courses: ["Information Technology", "Multimedia", "Fashion Design"] }
    ]
  },
  {
    id: "uct",
    name: "University of Cape Town",
    province: "Western Cape",
    type: "University",
    applicationDeadline: "2026-07-31",
    faculties: [
      { name: "Commerce", courses: ["Accounting", "Economics", "Business Science"] },
      { name: "Humanities", courses: ["Law", "Psychology", "Politics"] },
      { name: "Science", courses: ["Computer Science", "Environmental Science", "Mathematics"] }
    ]
  },
  {
    id: "tut",
    name: "Tshwane University of Technology",
    province: "Gauteng",
    type: "University of Technology",
    applicationDeadline: "2026-09-30",
    faculties: [
      { name: "ICT", courses: ["Computer Science", "Information Technology", "Informatics"] },
      { name: "Engineering", courses: ["Industrial Engineering", "Electrical Engineering", "Civil Engineering"] },
      { name: "Management Sciences", courses: ["Marketing", "Supply Chain Management", "Human Resources"] }
    ]
  },
  {
    id: "cut",
    name: "Central University of Technology",
    province: "Free State",
    type: "University of Technology",
    applicationDeadline: "2026-09-30",
    faculties: [
      { name: "Engineering, Built Environment and IT", courses: ["Information Technology", "Civil Engineering", "Construction"] },
      { name: "Health and Environmental Sciences", courses: ["Clinical Technology", "Dental Assisting", "Radiography"] },
      { name: "Management Sciences", courses: ["Accounting", "Hospitality", "Office Management"] }
    ]
  },
  {
    id: "majuba-tvet",
    name: "Majuba TVET College",
    province: "KwaZulu-Natal",
    type: "TVET",
    applicationDeadline: "2026-11-15",
    faculties: [
      { name: "Engineering Studies", courses: ["Electrical Engineering N4", "Mechanical Engineering N4", "Civil Engineering N4"] },
      { name: "Business Studies", courses: ["Financial Management N4", "Business Management N4", "Marketing Management N4"] }
    ]
  },
  {
    id: "coastal-tvet",
    name: "Coastal TVET College",
    province: "KwaZulu-Natal",
    type: "TVET",
    applicationDeadline: "2026-11-15",
    faculties: [
      { name: "Business Studies", courses: ["Business Management N4", "Public Management N4", "Management Assistant N4"] },
      { name: "Engineering Studies", courses: ["Electrical Engineering N4", "Civil Engineering N4", "Mechanical Engineering N4"] }
    ]
  },
  {
    id: "taletso-tvet",
    name: "Taletso TVET College",
    province: "North West",
    type: "TVET",
    applicationDeadline: "2026-11-15",
    faculties: [
      { name: "Business and Utility Studies", courses: ["Management Assistant N4", "Financial Management N4", "Hospitality"] },
      { name: "Engineering", courses: ["Boilermaking", "Fitting and Turning", "Electrical Infrastructure Construction"] }
    ]
  },
  {
    id: "nmu",
    name: "Nelson Mandela University",
    province: "Eastern Cape",
    type: "University",
    applicationDeadline: "2026-09-30",
    faculties: [
      { name: "Business and Economic Sciences", courses: ["Accounting", "Economics", "Business Management"] },
      { name: "Engineering", courses: ["Mechatronics", "Industrial Engineering", "Electrical Engineering"] },
      { name: "Health Sciences", courses: ["Nursing", "Emergency Medical Care", "Biokinetics"] }
    ]
  }
];

function normalizeInstitutionStatus(status?: string | null, allowAuto = false) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "open") return "open";
  if (value === "closing_soon" || value === "closing soon") return "closing_soon";
  if (value === "closed") return "closed";
  if (allowAuto && value === "auto") return "auto";
  return "";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function deriveInstitutionStatus(record: CatalogInstitution) {
  if (record.isActive === false) return "closed";
  const manualStatus = normalizeInstitutionStatus(record.manualStatus);
  if (manualStatus) return manualStatus as "open" | "closing_soon" | "closed";
  const closingDate = String(record.closingDate || record.applicationDeadline || "").trim();
  if (!closingDate) return "open";
  if (todayKey() > closingDate) return "closed";
  const diffMs = new Date(`${closingDate}T23:59:59`).getTime() - new Date(`${todayKey()}T00:00:00`).getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  return diffDays <= 7 ? "closing_soon" : "open";
}

function normalizeCatalogInstitution(record: CatalogInstitution): CatalogInstitution {
  const year = String(record.year || record.applicationDeadline?.slice(0, 4) || new Date().getFullYear());
  const closingDate = String(record.closingDate || record.applicationDeadline || "").trim();
  const normalized: CatalogInstitution = {
    ...record,
    shortName: record.shortName || "",
    year,
    openingDate: record.openingDate || `${year}-01-15`,
    closingDate,
    applicationDeadline: closingDate,
    isActive: record.isActive !== false,
    manualStatus: normalizeInstitutionStatus(record.manualStatus) as CatalogInstitution["manualStatus"],
    faculties: Array.isArray(record.faculties) ? record.faculties : []
  };
  return {
    ...normalized,
    status: deriveInstitutionStatus(normalized)
  };
}

let institutionCatalogState: CatalogInstitution[] = seedInstitutionCatalog.map(normalizeCatalogInstitution);

function getInstitutionCatalogState(filters?: {
  year?: string;
  status?: string;
  province?: string;
  type?: string;
  search?: string;
  includeInactive?: boolean;
}) {
  const query = String(filters?.search || "").trim().toLowerCase();
  const year = String(filters?.year || "").trim();
  const status = normalizeInstitutionStatus(filters?.status);

  return institutionCatalogState.filter((institution) => {
    if (filters?.province && institution.province !== filters.province) return false;
    if (filters?.type && institution.type !== filters.type) return false;
    if (year && String(institution.year) !== year) return false;
    if (status && institution.status !== status) return false;
    if (filters?.includeInactive === false && institution.isActive === false) return false;
    if (query) {
      const haystack = [
        institution.name,
        institution.province,
        institution.type,
        institution.year,
        institution.status,
        ...institution.faculties.map((faculty) => `${faculty.name} ${faculty.courses.join(" ")}`)
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (String(a.year) !== String(b.year)) return String(b.year).localeCompare(String(a.year));
    return a.name.localeCompare(b.name);
  });
}

function findInstitutionCatalogEntry(name: string, year?: string) {
  const normalizedName = String(name || "").trim().toLowerCase();
  if (!normalizedName) return null;
  return institutionCatalogState.find((institution) => {
    if (institution.name.trim().toLowerCase() !== normalizedName) return false;
    if (year && String(institution.year) !== String(year)) return false;
    return true;
  }) || null;
}

function nowISO() {
  return new Date().toISOString();
}

function createError(message: string, status: number) {
  const error = new Error(message);
  (error as Error & { status: number }).status = status;
  return error;
}

function getClient() {
  return getSupabaseAdminClient() as any;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeProvince(value: unknown): ApplicationFormsSnapshot["learner"]["province"] {
  const text = cleanText(value);
  return (SOUTH_AFRICAN_PROVINCES as readonly string[]).includes(text)
    ? text as ApplicationFormsSnapshot["learner"]["province"]
    : "";
}

function emptyForms(): ApplicationFormsSnapshot {
  return {
    learner: {},
    parent: {},
    school: {},
    marks: { subjects: [] }
  };
}

function mapPack(row: RemoteApplicationPack): ApplicationPack {
  const fallback = fallbackPacks.find((item) => item.name === row.name || item.id === row.code);
  return {
    id: row.id,
    name: row.name,
    price: asNumber(row.price),
    institutionLimit: row.is_unlimited ? "unlimited" : (row.institution_limit ?? fallback?.institutionLimit ?? 0),
    description: cleanText(row.description) || fallback?.description || "",
    highlight: cleanText(row.highlight) || fallback?.highlight || ""
  };
}

function mapMark(row: RemoteApplicationMark): ApplicationMark {
  return {
    id: row.id,
    subject: row.subject,
    percent: asNumber(row.percent),
    level: asNumber(row.level)
  };
}

function mapInstitution(row: RemoteApplicationInstitution): InstitutionChoice {
  const matched = findInstitutionCatalogEntry(row.institution_name);
  return {
    id: row.id,
    institutionId: matched?.id,
    province: row.province,
    institutionType: row.institution_type,
    institutionName: row.institution_name,
    faculty: row.faculty,
    choice1: row.choice_1,
    choice2: row.choice_2,
    choice3: row.choice_3,
    year: matched?.year,
    institutionStatus: matched?.status,
    closingDate: matched?.closingDate || matched?.applicationDeadline
  };
}

function mapNotification(row: RemoteNotification): NotificationRecord {
  const type = row.notification_type;
  return {
    id: row.id,
    userId: row.user_id || "",
    title: row.title,
    message: row.message,
    type: type === "success" || type === "warn" || type === "error" ? type : "info",
    read: Boolean(row.is_read),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupportThread(row: RemoteSupportThread): SupportThreadRecord {
  return {
    id: row.id,
    userId: row.user_id,
    assistantId: row.assistant_id || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupportMessage(row: RemoteSupportMessage): SupportMessageRecord {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCallback(row: RemoteCallbackRequest): CallbackRequestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    assignedAssistantId: row.assigned_assistant_id || null,
    phone: row.phone,
    preferredTime: cleanText(row.preferred_time),
    note: cleanText(row.note),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildForms(
  profile: RemoteProfile | null,
  userProfile: RemoteUserProfile | null,
  guardianProfile: RemoteGuardianProfile | null,
  schoolProfile: RemoteSchoolProfile | null,
  marks: ApplicationMark[]
): ApplicationFormsSnapshot {
  return {
    learner: {
      idNumber: cleanText(userProfile?.id_number),
      fullNames: cleanText(profile?.full_name),
      surname: cleanText(userProfile?.surname),
      maidenName: cleanText(userProfile?.maiden_name),
      cellphone: cleanText(profile?.phone),
      email: cleanText(profile?.email),
      province: normalizeProvince(userProfile?.province),
      postalCode: cleanText(userProfile?.postal_code),
      address: cleanText(userProfile?.address),
      dob: cleanText(userProfile?.date_of_birth),
      gender: cleanText(userProfile?.gender),
      homeLanguage: cleanText(userProfile?.home_language)
    },
    parent: {
      relation: cleanText(guardianProfile?.relation),
      guardianId: cleanText(guardianProfile?.guardian_id),
      fullNames: cleanText(guardianProfile?.full_names),
      surname: cleanText(guardianProfile?.surname),
      phone1: cleanText(guardianProfile?.phone_1),
      phone2: cleanText(guardianProfile?.phone_2),
      email: cleanText(guardianProfile?.email),
      province: normalizeProvince(guardianProfile?.province),
      postalCode: cleanText(guardianProfile?.postal_code),
      address: cleanText(guardianProfile?.address)
    },
    school: {
      schoolName: cleanText(schoolProfile?.school_name),
      confirmName: cleanText(schoolProfile?.confirm_name),
      schoolProvince: normalizeProvince(schoolProfile?.school_province),
      schoolType: cleanText(schoolProfile?.school_type),
      completionYear: schoolProfile?.completion_year ? String(schoolProfile.completion_year) : "",
      average: schoolProfile?.average ?? ""
    },
    marks: {
      subjects: marks
    }
  };
}

function mapApplication(
  application: RemoteApplication,
  forms: ApplicationFormsSnapshot,
  marks: ApplicationMark[],
  institutions: InstitutionChoice[]
): ApplicationRecord {
  return {
    id: application.id,
    userId: application.user_id,
    assistantId: application.assistant_id || null,
    packageId: application.package_id || null,
    status: application.status,
    paymentStatus: application.payment_status,
    submittedAt: application.submitted_at || null,
    forms,
    marks,
    institutions,
    services: [],
    createdAt: application.created_at,
    updatedAt: application.updated_at
  };
}

function calculateReadiness(application: ApplicationRecord) {
  const learner = application.forms.learner || {};
  const school = application.forms.school || {};
  const checks = [
    Boolean(learner.fullNames),
    Boolean(learner.email),
    Boolean(learner.idNumber),
    Boolean(school.schoolName),
    application.marks.length >= 5,
    Boolean(application.packageId),
    application.institutions.length >= 1
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

async function ensureSupportingRows(userId: string) {
  const client = getClient();
  const timestamp = nowISO();
  const [userProfileResult, guardianProfileResult, schoolProfileResult, cartResult] = await Promise.all([
    client.from("user_profiles").upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" }),
    client.from("guardian_profiles").upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" }),
    client.from("school_profiles").upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" }),
    client.from("carts").upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" })
  ]);

  const failures = [userProfileResult.error, guardianProfileResult.error, schoolProfileResult.error, cartResult.error].filter(Boolean);
  if (failures.length) {
    throw createError(failures[0]?.message || "Could not prepare the Kagie data rows.", 500);
  }
}

async function loadUserRecord(userId: string): Promise<UserRecord> {
  const client = getClient();
  const result = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (result.error) {
    throw createError(result.error.message || "Could not load the Kagie profile.", 500);
  }
  if (!result.data) {
    throw createError("Kagie profile was not found.", 404);
  }
  return mapSupabaseProfileToUserRecord(result.data as RemoteProfile);
}

async function getLatestApplicationRow(userId: string): Promise<RemoteApplication | null> {
  const client = getClient();
  const result = await client
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw createError(result.error.message || "Could not load the Kagie applications.", 500);
  }
  return (result.data as RemoteApplication | null) || null;
}

async function getDraftApplicationRow(userId: string): Promise<RemoteApplication | null> {
  const client = getClient();
  const result = await client
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .eq("status", APPLICATION_STATUSES.DRAFT)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw createError(result.error.message || "Could not load the Kagie draft.", 500);
  }
  return (result.data as RemoteApplication | null) || null;
}

async function getOwnedApplicationRow(userId: string, applicationId: string): Promise<RemoteApplication> {
  const client = getClient();
  const result = await client
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) {
    throw createError(result.error.message || "Could not load the Kagie application.", 500);
  }
  if (!result.data) {
    throw createError("Application not found.", 404);
  }
  return result.data as RemoteApplication;
}

async function loadProfileRows(userId: string) {
  const client = getClient();
  const [profileResult, userProfileResult, guardianProfileResult, schoolProfileResult] = await Promise.all([
    client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    client.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.from("guardian_profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.from("school_profiles").select("*").eq("user_id", userId).maybeSingle()
  ]);

  const failures = [profileResult.error, userProfileResult.error, guardianProfileResult.error, schoolProfileResult.error].filter(Boolean);
  if (failures.length) {
    throw createError(failures[0]?.message || "Could not load the Kagie profile rows.", 500);
  }

  return {
    profile: (profileResult.data as RemoteProfile | null) || null,
    userProfile: (userProfileResult.data as RemoteUserProfile | null) || null,
    guardianProfile: (guardianProfileResult.data as RemoteGuardianProfile | null) || null,
    schoolProfile: (schoolProfileResult.data as RemoteSchoolProfile | null) || null
  };
}

async function loadApplicationChildren(applicationId: string) {
  const client = getClient();
  const [marksResult, institutionsResult] = await Promise.all([
    client.from("application_marks").select("*").eq("application_id", applicationId).order("created_at", { ascending: true }),
    client.from("application_institutions").select("*").eq("application_id", applicationId).order("created_at", { ascending: true })
  ]);

  const failures = [marksResult.error, institutionsResult.error].filter(Boolean);
  if (failures.length) {
    throw createError(failures[0]?.message || "Could not load the Kagie application details.", 500);
  }

  const marks = ((marksResult.data as RemoteApplicationMark[] | null) || []).map(mapMark);
  const institutions = ((institutionsResult.data as RemoteApplicationInstitution[] | null) || []).map(mapInstitution);

  return { marks, institutions };
}

async function assembleApplication(application: RemoteApplication) {
  const [{ profile, userProfile, guardianProfile, schoolProfile }, { marks, institutions }] = await Promise.all([
    loadProfileRows(application.user_id),
    loadApplicationChildren(application.id)
  ]);
  const forms = buildForms(profile, userProfile, guardianProfile, schoolProfile, marks);
  return mapApplication(application, forms, marks, institutions);
}

async function getPackRows(): Promise<RemoteApplicationPack[]> {
  const client = getClient();
  const result = await client
    .from("application_packs")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (result.error) {
    throw createError(result.error.message || "Could not load the Kagie pack catalog.", 500);
  }
  return (result.data as RemoteApplicationPack[] | null) || [];
}

async function getPackById(packId: string | null | undefined) {
  if (!packId) return null;
  const client = getClient();
  const result = await client.from("application_packs").select("*").eq("id", packId).maybeSingle();
  if (result.error) {
    throw createError(result.error.message || "Could not load the selected Kagie pack.", 500);
  }
  return result.data ? mapPack(result.data as RemoteApplicationPack) : null;
}

async function ensureCartRecord(userId: string) {
  const client = getClient();
  const timestamp = nowISO();
  const result = await client
    .from("carts")
    .upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (result.error || !result.data) {
    throw createError(result.error?.message || "Could not load the Kagie cart.", 500);
  }
  return result.data as { id: string; user_id: string };
}

async function clearCartRecords(userId: string) {
  const client = getClient();
  const cart = await ensureCartRecord(userId);
  const [deleteItems, updateCart] = await Promise.all([
    client.from("cart_items").delete().eq("cart_id", cart.id),
    client.from("carts").update({ total_amount: 0, updated_at: nowISO() }).eq("id", cart.id)
  ]);

  const failures = [deleteItems.error, updateCart.error].filter(Boolean);
  if (failures.length) {
    throw createError(failures[0]?.message || "Could not reset the Kagie cart records.", 500);
  }
}

async function syncCartFromApplication(userId: string, application: ApplicationRecord) {
  const client = getClient();
  const cart = await ensureCartRecord(userId);
  const pack = await getPackById(application.packageId);

  const deleteItems = await client.from("cart_items").delete().eq("cart_id", cart.id);
  if (deleteItems.error) {
    throw createError(deleteItems.error.message || "Could not refresh the Kagie cart items.", 500);
  }

  const items = [];
  if (pack) {
    items.push({
      cart_id: cart.id,
      item_type: "application_pack",
      ref_id: pack.id,
      name: pack.name,
      price: pack.price,
      quantity: 1,
      metadata: {
        institutionLimit: pack.institutionLimit
      }
    });
  }

  items.push(...application.institutions.map((institution) => ({
    cart_id: cart.id,
    item_type: "institution",
    ref_id: institution.id,
    name: institution.institutionName,
    price: 0,
    quantity: 1,
    metadata: {
      faculty: institution.faculty,
      choice1: institution.choice1,
      choice2: institution.choice2,
      choice3: institution.choice3
    }
  })));

  const operations = [
    client.from("carts").update({ total_amount: pack?.price || 0, updated_at: nowISO() }).eq("id", cart.id)
  ];
  if (items.length) {
    operations.push(client.from("cart_items").insert(items));
  }

  const results = await Promise.all(operations);
  const failures = results
    .map((entry) => ("error" in entry ? entry.error : null))
    .filter(Boolean);
  if (failures.length) {
    throw createError(failures[0]?.message || "Could not sync the Kagie cart.", 500);
  }
}

async function touchApplication(applicationId: string) {
  const client = getClient();
  const result = await client.from("applications").update({ updated_at: nowISO() }).eq("id", applicationId);
  if (result.error) {
    throw createError(result.error.message || "Could not update the Kagie application timestamp.", 500);
  }
}

async function pushNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationRecord["type"] = "info"
) {
  const client = getClient();
  const result = await client
    .from("notifications")
    .insert({
      user_id: userId,
      title,
      message,
      notification_type: type
    })
    .select("*")
    .single();

  if (result.error || !result.data) {
    throw createError(result.error?.message || "Could not create the Kagie notification.", 500);
  }

  return mapNotification(result.data as RemoteNotification);
}

async function ensureSupportThread(userId: string) {
  const client = getClient();
  const existing = await client
    .from("support_threads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw createError(existing.error.message || "Could not load the Kagie support thread.", 500);
  }
  if (existing.data) {
    return mapSupportThread(existing.data as RemoteSupportThread);
  }

  const created = await client
    .from("support_threads")
    .insert({
      user_id: userId,
      status: "open"
    })
    .select("*")
    .single();

  if (created.error || !created.data) {
    throw createError(created.error?.message || "Could not create the Kagie support thread.", 500);
  }

  return mapSupportThread(created.data as RemoteSupportThread);
}

function learnerProfilePatch(payload: Record<string, string | number | null>) {
  const profilePatch: Record<string, string> = {};
  const userProfilePatch: Record<string, string | null> = {};

  if ("fullNames" in payload) profilePatch.full_name = cleanText(payload.fullNames);
  if ("email" in payload) profilePatch.email = cleanText(payload.email);
  if ("cellphone" in payload) profilePatch.phone = cleanText(payload.cellphone);

  if ("idNumber" in payload) userProfilePatch.id_number = cleanText(payload.idNumber);
  if ("surname" in payload) userProfilePatch.surname = cleanText(payload.surname);
  if ("maidenName" in payload) userProfilePatch.maiden_name = cleanText(payload.maidenName);
  if ("dob" in payload) userProfilePatch.date_of_birth = cleanText(payload.dob) || null;
  if ("gender" in payload) userProfilePatch.gender = cleanText(payload.gender);
  if ("homeLanguage" in payload) userProfilePatch.home_language = cleanText(payload.homeLanguage);
  if ("province" in payload) userProfilePatch.province = cleanText(payload.province);
  if ("postalCode" in payload) userProfilePatch.postal_code = cleanText(payload.postalCode);
  if ("address" in payload) userProfilePatch.address = cleanText(payload.address);

  return { profilePatch, userProfilePatch };
}

function guardianProfilePatch(payload: Record<string, string | number | null>) {
  const guardianPatch: Record<string, string> = {};
  if ("relation" in payload) guardianPatch.relation = cleanText(payload.relation);
  if ("guardianId" in payload) guardianPatch.guardian_id = cleanText(payload.guardianId);
  if ("fullNames" in payload) guardianPatch.full_names = cleanText(payload.fullNames);
  if ("surname" in payload) guardianPatch.surname = cleanText(payload.surname);
  if ("phone1" in payload) guardianPatch.phone_1 = cleanText(payload.phone1);
  if ("phone2" in payload) guardianPatch.phone_2 = cleanText(payload.phone2);
  if ("email" in payload) guardianPatch.email = cleanText(payload.email);
  if ("province" in payload) guardianPatch.province = cleanText(payload.province);
  if ("postalCode" in payload) guardianPatch.postal_code = cleanText(payload.postalCode);
  if ("address" in payload) guardianPatch.address = cleanText(payload.address);
  return guardianPatch;
}

function schoolProfilePatch(payload: Record<string, string | number | null>) {
  const schoolPatch: Record<string, string | number | null> = {};
  if ("schoolName" in payload) schoolPatch.school_name = cleanText(payload.schoolName);
  if ("confirmName" in payload) schoolPatch.confirm_name = cleanText(payload.confirmName);
  if ("schoolProvince" in payload) schoolPatch.school_province = cleanText(payload.schoolProvince);
  if ("schoolType" in payload) schoolPatch.school_type = cleanText(payload.schoolType);
  if ("completionYear" in payload) {
    const yearText = cleanText(payload.completionYear);
    schoolPatch.completion_year = yearText ? Number(yearText) : null;
  }
  if ("average" in payload) {
    if (payload.average === null || payload.average === "") {
      schoolPatch.average = null;
    } else {
      schoolPatch.average = asNumber(payload.average);
    }
  }
  return schoolPatch;
}

export async function getPackCatalog() {
  const rows = await getPackRows();
  if (!rows.length) {
    return fallbackPacks;
  }
  return rows.map(mapPack);
}

export async function getReferenceCatalog(filters?: {
  year?: string;
  status?: string;
  province?: string;
  type?: string;
  search?: string;
}) {
  const institutions = getInstitutionCatalogState({
    ...(filters || {}),
    includeInactive: true
  });
  return {
    packs: await getPackCatalog(),
    provinces: [...SOUTH_AFRICAN_PROVINCES],
    schoolTypes: [...schoolTypes],
    homeLanguages: [...homeLanguages],
    subjects: [...subjects],
    paymentMethods: [...paymentMethods],
    institutionTypes: ["University", "University of Technology", "TVET"],
    institutionYears: [...new Set(institutionCatalogState.map((institution) => String(institution.year || "")).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    institutions: institutions.map((institution) => ({ ...institution })),
    services: [...extraServices],
    updates: [...updateCards],
    prospectus: institutions.map((institution) => ({
      id: institution.id,
      institution: institution.name,
      shortName: institution.name,
      province: institution.province,
      type: institution.type,
      year: institution.year || "2026",
      status: institution.status || "open",
      summary: `${institution.name} offers ${institution.faculties.length} major study areas through Kagie's mobile prospectus guide.`,
      applicationDeadline: institution.closingDate || institution.applicationDeadline
    }))
  };
}

export async function listInstitutions(filters?: {
  year?: string;
  status?: string;
  province?: string;
  type?: string;
  search?: string;
  includeInactive?: boolean;
}) {
  return getInstitutionCatalogState(filters);
}

export async function addInstitutionCatalogEntry(input: (Omit<Partial<CatalogInstitution>, "status" | "manualStatus"> & { name: string; province: string; type: string; year: string; }) & { status?: string; manualStatus?: string; }) {
  const duplicate = findInstitutionCatalogEntry(input.name, input.year);
  if (duplicate) throw createError("Institution already exists for that year.", 409);

  const created = normalizeCatalogInstitution({
    id: input.id || randomUUID(),
    name: input.name,
    province: input.province,
    type: input.type,
    year: input.year,
    openingDate: input.openingDate,
    applicationDeadline: input.closingDate || input.applicationDeadline || "",
    closingDate: input.closingDate,
    status: normalizeInstitutionStatus(input.status) as CatalogInstitution["status"],
    manualStatus: normalizeInstitutionStatus(input.manualStatus || input.status) as CatalogInstitution["manualStatus"],
    isActive: input.isActive !== false,
    faculties: Array.isArray(input.faculties) ? input.faculties : []
  });

  institutionCatalogState = [...institutionCatalogState, created];
  return created;
}

export async function updateInstitutionCatalogEntry(id: string, patch: Omit<Partial<CatalogInstitution>, "status" | "manualStatus"> & { status?: string; manualStatus?: string; }) {
  const current = institutionCatalogState.find((institution) => institution.id === id);
  if (!current) throw createError("Institution not found.", 404);
  const { status: _status, manualStatus: _manualStatus, ...restPatch } = patch;

  const updated = normalizeCatalogInstitution({
    ...current,
    ...restPatch,
    id,
    manualStatus: normalizeInstitutionStatus(patch.manualStatus || patch.status, true) === "auto"
      ? ""
      : normalizeInstitutionStatus(patch.manualStatus || patch.status) as CatalogInstitution["manualStatus"]
  });

  institutionCatalogState = institutionCatalogState.map((institution) => institution.id === id ? updated : institution);
  return updated;
}

export async function deleteInstitutionCatalogEntry(id: string) {
  const current = institutionCatalogState.find((institution) => institution.id === id);
  if (!current) throw createError("Institution not found.", 404);
  institutionCatalogState = institutionCatalogState.filter((institution) => institution.id !== id);
  return { success: true };
}

export async function ensureDraft(userId: string) {
  await ensureSupportingRows(userId);
  const existing = await getDraftApplicationRow(userId);
  if (existing) {
    const assembled = await assembleApplication(existing);
    await syncCartFromApplication(userId, assembled);
    return assembled;
  }

  const client = getClient();
  const created = await client
    .from("applications")
    .insert({
      user_id: userId
    })
    .select("*")
    .single();

  if (created.error || !created.data) {
    throw createError(created.error?.message || "Could not create the Kagie draft.", 500);
  }

  await ensureSupportThread(userId);
  await pushNotification(userId, "Draft ready", "Your Kagie mobile draft is ready. Complete your details and choose a package.", "info");

  const assembled = await assembleApplication(created.data as RemoteApplication);
  await syncCartFromApplication(userId, assembled);
  return assembled;
}

export async function getLatestApplication(userId: string) {
  const latest = await getLatestApplicationRow(userId);
  return latest ? assembleApplication(latest) : null;
}

export async function saveFormSection(
  userId: string,
  applicationId: string,
  section: ApplicationSection,
  data: Record<string, string | number | null>
) {
  await ensureSupportingRows(userId);
  const application = await getOwnedApplicationRow(userId, applicationId);
  const client = getClient();
  const timestamp = nowISO();

  if (section === "learner") {
    const { profilePatch, userProfilePatch } = learnerProfilePatch(data);
    const operations = [];
    if (Object.keys(profilePatch).length) {
      operations.push(
        client.from("profiles").update({ ...profilePatch, updated_at: timestamp }).eq("id", userId)
      );
    }
    operations.push(
      client.from("user_profiles").upsert({ user_id: userId, ...userProfilePatch, updated_at: timestamp }, { onConflict: "user_id" })
    );
    const results = await Promise.all(operations);
    const failure = results.find((item) => item.error);
    if (failure?.error) {
      throw createError(failure.error.message || "Could not save learner details.", 500);
    }
  }

  if (section === "parent") {
    const guardianPatch = guardianProfilePatch(data);
    const result = await client
      .from("guardian_profiles")
      .upsert({ user_id: userId, ...guardianPatch, updated_at: timestamp }, { onConflict: "user_id" });
    if (result.error) {
      throw createError(result.error.message || "Could not save guardian details.", 500);
    }
  }

  if (section === "school") {
    const schoolPatch = schoolProfilePatch(data);
    const result = await client
      .from("school_profiles")
      .upsert({ user_id: userId, ...schoolPatch, updated_at: timestamp }, { onConflict: "user_id" });
    if (result.error) {
      throw createError(result.error.message || "Could not save school details.", 500);
    }
  }

  await touchApplication(application.id);
  return assembleApplication(await getOwnedApplicationRow(userId, applicationId));
}

export async function saveMarks(userId: string, applicationId: string, marks: ApplicationMark[]) {
  const application = await getOwnedApplicationRow(userId, applicationId);
  const client = getClient();

  const deleteResult = await client.from("application_marks").delete().eq("application_id", application.id);
  if (deleteResult.error) {
    throw createError(deleteResult.error.message || "Could not replace the application marks.", 500);
  }

  if (marks.length) {
    const insertResult = await client.from("application_marks").insert(
      marks.map((mark) => ({
        id: mark.id && /^[0-9a-fA-F-]{36}$/.test(mark.id) ? mark.id : randomUUID(),
        application_id: application.id,
        subject: mark.subject,
        percent: mark.percent,
        level: mark.level
      }))
    );
    if (insertResult.error) {
      throw createError(insertResult.error.message || "Could not save the application marks.", 500);
    }
  }

  await touchApplication(application.id);
  return assembleApplication(await getOwnedApplicationRow(userId, applicationId));
}

export async function setPackage(userId: string, applicationId: string, packageId: string) {
  const application = await getOwnedApplicationRow(userId, applicationId);
  if (application.status !== APPLICATION_STATUSES.DRAFT) {
    throw createError("Only draft applications can change packages.", 400);
  }

  const pack = await getPackById(packageId);
  if (!pack) {
    throw createError("Selected package was not found.", 404);
  }

  const client = getClient();
  const result = await client
    .from("applications")
    .update({
      package_id: pack.id,
      payment_amount: pack.price,
      updated_at: nowISO()
    })
    .eq("id", application.id);

  if (result.error) {
    throw createError(result.error.message || "Could not save the selected package.", 500);
  }

  await pushNotification(userId, "Package selected", `${pack.name} has been attached to your draft.`, "success");
  const assembled = await assembleApplication(await getOwnedApplicationRow(userId, applicationId));
  await syncCartFromApplication(userId, assembled);
  return assembled;
}

export async function addInstitution(userId: string, applicationId: string, payload: Omit<InstitutionChoice, "id">) {
  const application = await getOwnedApplicationRow(userId, applicationId);
  if (application.status !== APPLICATION_STATUSES.DRAFT) {
    throw createError("Only draft applications can add institutions.", 400);
  }

  const pack = await getPackById(application.package_id);
  if (!pack) {
    throw createError("Choose a package before adding institutions.", 400);
  }

  const client = getClient();
  const existingInstitutions = await client
    .from("application_institutions")
    .select("*")
    .eq("application_id", application.id)
    .order("created_at", { ascending: true });

  if (existingInstitutions.error) {
    throw createError(existingInstitutions.error.message || "Could not check the current shortlist.", 500);
  }

  const mappedExisting = ((existingInstitutions.data as RemoteApplicationInstitution[] | null) || []).map(mapInstitution);
  if (pack.institutionLimit !== "unlimited" && mappedExisting.length >= pack.institutionLimit) {
    throw createError(`${pack.name} allows only ${pack.institutionLimit} institutions.`, 400);
  }

  const duplicate = mappedExisting.find((item) =>
    item.institutionName.trim().toLowerCase() === payload.institutionName.trim().toLowerCase()
    && item.faculty.trim().toLowerCase() === payload.faculty.trim().toLowerCase()
  );
  if (duplicate) {
    throw createError("That institution and faculty combination is already in your shortlist.", 409);
  }

  const catalogInstitution = findInstitutionCatalogEntry(payload.institutionName, payload.year);
  if (catalogInstitution && (catalogInstitution.isActive === false || catalogInstitution.status === "closed")) {
    throw createError("Applications for this institution are closed.", 400);
  }

  const insert = await client.from("application_institutions").insert({
    application_id: application.id,
    province: payload.province,
    institution_type: payload.institutionType,
    institution_name: payload.institutionName,
    faculty: payload.faculty,
    choice_1: payload.choice1,
    choice_2: payload.choice2,
    choice_3: payload.choice3
  });

  if (insert.error) {
    throw createError(insert.error.message || "Could not add the institution.", 500);
  }

  await touchApplication(application.id);
  await pushNotification(userId, "Institution saved", `${payload.institutionName} has been added to your Kagie shortlist.`, "success");
  const assembled = await assembleApplication(await getOwnedApplicationRow(userId, applicationId));
  await syncCartFromApplication(userId, assembled);
  return assembled;
}

export async function removeInstitution(userId: string, applicationId: string, institutionId: string) {
  const application = await getOwnedApplicationRow(userId, applicationId);
  const client = getClient();
  const deletion = await client
    .from("application_institutions")
    .delete()
    .eq("application_id", application.id)
    .eq("id", institutionId);

  if (deletion.error) {
    throw createError(deletion.error.message || "Could not remove the institution.", 500);
  }

  await touchApplication(application.id);
  const assembled = await assembleApplication(await getOwnedApplicationRow(userId, applicationId));
  await syncCartFromApplication(userId, assembled);
  return assembled;
}

export async function getCartSummary(userId: string) {
  const draft = await getDraftApplicationRow(userId);
  if (!draft) {
    await clearCartRecords(userId);
    return {
      applicationId: null,
      pack: null,
      institutions: [],
      total: 0,
      canCheckout: false,
      paymentStatus: PAYMENT_STATUSES.PAYMENT_PENDING,
      status: APPLICATION_STATUSES.DRAFT
    };
  }

  const assembled = await assembleApplication(draft);
  const pack = await getPackById(assembled.packageId);
  await syncCartFromApplication(userId, assembled);

  return {
    applicationId: assembled.id,
    pack,
    institutions: assembled.institutions,
    total: pack?.price || 0,
    canCheckout: Boolean(pack && assembled.institutions.length),
    paymentStatus: assembled.paymentStatus,
    status: assembled.status
  };
}

export async function clearCart(userId: string, applicationId: string) {
  const application = await getOwnedApplicationRow(userId, applicationId);
  if (application.status !== APPLICATION_STATUSES.DRAFT) {
    throw createError("Only draft applications can be cleared.", 400);
  }

  const client = getClient();
  const [deleteInstitutions, updateApplication] = await Promise.all([
    client.from("application_institutions").delete().eq("application_id", application.id),
    client.from("applications").update({
      package_id: null,
      payment_amount: 0,
      payment_status: PAYMENT_STATUSES.PAYMENT_PENDING,
      updated_at: nowISO()
    }).eq("id", application.id)
  ]);

  const failures = [deleteInstitutions.error, updateApplication.error].filter(Boolean);
  if (failures.length) {
    throw createError(failures[0]?.message || "Could not clear the current Kagie cart.", 500);
  }

  await clearCartRecords(userId);
  await pushNotification(userId, "Cart cleared", "Your package and institution shortlist were removed from the current draft.", "warn");
  return assembleApplication(await getOwnedApplicationRow(userId, applicationId));
}

export async function submitCheckout(userId: string, applicationId: string, payload: CheckoutPayload) {
  const application = await getOwnedApplicationRow(userId, applicationId);
  if (application.status !== APPLICATION_STATUSES.DRAFT) {
    throw createError("Only draft applications can be checked out.", 400);
  }

  const assembled = await assembleApplication(application);
  const pack = await getPackById(assembled.packageId);
  if (!pack) {
    throw createError("Choose a package before checking out.", 400);
  }
  if (!assembled.institutions.length) {
    throw createError("Add at least one institution before checking out.", 400);
  }

  const client = getClient();
  const timestamp = nowISO();
  const paymentInsert = await client
    .from("payments")
    .insert({
      application_id: application.id,
      payer_name: payload.payerName,
      phone: payload.phone,
      reference: payload.reference,
      method: payload.method,
      note: payload.note || "",
      amount: pack.price,
      status: PAYMENT_STATUSES.PENDING_VERIFICATION
    })
    .select("*")
    .single();

  if (paymentInsert.error || !paymentInsert.data) {
    throw createError(paymentInsert.error?.message || "Could not log the Kagie payment.", 500);
  }

  const appUpdate = await client
    .from("applications")
    .update({
      package_id: pack.id,
      payment_status: PAYMENT_STATUSES.PENDING_VERIFICATION,
      status: APPLICATION_STATUSES.PROCESSING,
      payer_name: payload.payerName,
      payer_phone: payload.phone,
      payment_reference: payload.reference,
      payment_method: payload.method,
      payment_note: payload.note || "",
      payment_amount: pack.price,
      submitted_at: timestamp,
      updated_at: timestamp
    })
    .eq("id", application.id);

  if (appUpdate.error) {
    throw createError(appUpdate.error.message || "Could not move the application into processing.", 500);
  }

  await clearCartRecords(userId);
  await Promise.all([
    pushNotification(userId, "Payment submitted", `Your ${pack.name} payment was logged. Kagie will verify it shortly.`, "success"),
    pushNotification(userId, "Application being processed", "Your shortlist has moved into the Kagie processing queue.", "info")
  ]);

  return {
    application: await assembleApplication(await getOwnedApplicationRow(userId, applicationId)),
    payment: {
      id: paymentInsert.data.id,
      applicationId: application.id,
      payerName: paymentInsert.data.payer_name,
      phone: paymentInsert.data.phone,
      reference: paymentInsert.data.reference,
      method: paymentInsert.data.method,
      note: paymentInsert.data.note,
      amount: asNumber(paymentInsert.data.amount),
      status: paymentInsert.data.status,
      createdAt: paymentInsert.data.created_at,
      updatedAt: paymentInsert.data.updated_at
    } as PaymentRecord
  };
}

export async function getDashboardSummary(userId: string) {
  const latest = await getLatestApplication(userId) || await ensureDraft(userId);
  const pack = await getPackById(latest.packageId);
  const thread = await ensureSupportThread(userId);
  const notifications = await getNotifications(userId);

  return {
    latestApplication: latest,
    pack,
    readiness: calculateReadiness(latest),
    pendingTasks: [
      !latest.forms.learner?.fullNames ? "Complete learner details" : null,
      !latest.forms.parent?.fullNames ? "Add guardian details" : null,
      !latest.forms.school?.schoolName ? "Add school information" : null,
      latest.marks.length < 5 ? "Capture at least 5 subjects" : null,
      !latest.packageId ? "Choose an application pack" : null,
      !latest.institutions.length ? "Add at least one institution" : null,
      latest.status === APPLICATION_STATUSES.PROCESSING ? "Wait for Kagie payment verification" : null
    ].filter(Boolean),
    notifications: notifications.slice(0, 5),
    unreadCount: notifications.filter((item) => !item.read).length,
    supportStatus: thread.status,
    quickStats: {
      institutions: latest.institutions.length,
      subjects: latest.marks.length,
      packageAmount: pack?.price || 0
    }
  };
}

export async function getNotifications(userId: string) {
  const client = getClient();
  const result = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw createError(result.error.message || "Could not load the Kagie notifications.", 500);
  }

  return ((result.data as RemoteNotification[] | null) || []).map(mapNotification);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const client = getClient();
  const result = await client
    .from("notifications")
    .update({ is_read: true, updated_at: nowISO() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (result.error) {
    throw createError(result.error.message || "Could not update the notification.", 500);
  }
  if (!result.data) {
    throw createError("Notification not found.", 404);
  }

  return mapNotification(result.data as RemoteNotification);
}

export async function getSupportSnapshot(userId: string) {
  const thread = await ensureSupportThread(userId);
  const client = getClient();
  const [messagesResult, callbacksResult] = await Promise.all([
    client.from("support_messages").select("*").eq("thread_id", thread.id).order("created_at", { ascending: true }),
    client.from("callback_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false })
  ]);

  const failures = [messagesResult.error, callbacksResult.error].filter(Boolean);
  if (failures.length) {
    throw createError(failures[0]?.message || "Could not load the Kagie support inbox.", 500);
  }

  return {
    thread,
    messages: ((messagesResult.data as RemoteSupportMessage[] | null) || []).map(mapSupportMessage),
    callbacks: ((callbacksResult.data as RemoteCallbackRequest[] | null) || []).map(mapCallback)
  };
}

export async function sendSupportMessage(userId: string, message: string) {
  const thread = await ensureSupportThread(userId);
  const client = getClient();
  const timestamp = nowISO();
  const [messageInsert, threadTouch] = await Promise.all([
    client.from("support_messages").insert({
      thread_id: thread.id,
      sender_id: userId,
      sender_role: ROLES.USER,
      message
    }),
    client.from("support_threads").update({ updated_at: timestamp }).eq("id", thread.id)
  ]);

  const failures = [messageInsert.error, threadTouch.error].filter(Boolean);
  if (failures.length) {
    throw createError(failures[0]?.message || "Could not send the support message.", 500);
  }

  await pushNotification(userId, "Support reply queued", "Your message reached Kagie support and is now in the response queue.", "info");
  return getSupportSnapshot(userId);
}

export async function requestCallback(userId: string, phone: string, preferredTime?: string, note?: string) {
  const client = getClient();
  const result = await client
    .from("callback_requests")
    .insert({
      user_id: userId,
      phone,
      preferred_time: preferredTime || "",
      note: note || "",
      status: CALLBACK_STATUSES.PENDING
    })
    .select("*")
    .single();

  if (result.error || !result.data) {
    throw createError(result.error?.message || "Could not save the callback request.", 500);
  }

  await pushNotification(userId, "Callback requested", "A Kagie assistant will call you back using the details you provided.", "success");
  return mapCallback(result.data as RemoteCallbackRequest);
}

export async function requestExtraService(userId: string, serviceId: string) {
  const service = extraServices.find((item) => item.id === serviceId);
  if (!service) {
    throw createError("That Kagie service was not found.", 404);
  }

  const thread = await ensureSupportThread(userId);
  const client = getClient();
  const saveMessage = await client.from("support_messages").insert({
    thread_id: thread.id,
    sender_id: userId,
    sender_role: ROLES.USER,
    message: `Service request: ${service.name} (R${service.price})`
  });

  if (saveMessage.error) {
    throw createError(saveMessage.error.message || "Could not log the extra service request.", 500);
  }

  await Promise.all([
    client.from("support_threads").update({ updated_at: nowISO() }).eq("id", thread.id),
    pushNotification(userId, "Service request logged", `${service.name} was sent to Kagie support for follow-up.`, "success")
  ]);

  return {
    service,
    support: await getSupportSnapshot(userId)
  };
}

export async function getProfileSnapshot(userId: string) {
  await ensureSupportingRows(userId);
  const user = await loadUserRecord(userId);
  const latest = await getLatestApplication(userId) || await ensureDraft(userId);
  return {
    user,
    learner: latest.forms.learner,
    parent: latest.forms.parent,
    school: latest.forms.school,
    marks: latest.marks,
    latestApplication: latest
  };
}
