import type { ApplicationPack } from "@kagie/shared";
import type { KagieUser } from "../../lib/types";

export type LatePackage = ApplicationPack & {
  applicationType: "late";
  level: "BASIC" | "STANDARD" | "PREMIUM" | "VIP";
  suitableFor: string;
};

export type LateSubject = {
  id: string;
  name: string;
  mark: string;
  percentage: string;
};

export type LateInstitution = {
  id: string;
  institutionName: string;
  campus: string;
  faculty: string;
  qualificationType: string;
  programme: string;
  intakeYear: string;
  intakeSemester: string;
  programmePriority: string;
};

export type LateDocumentKey =
  | "certifiedId"
  | "academicResults"
  | "proofOfAddress"
  | "motivationLetter"
  | "medicalLetter"
  | "affidavit"
  | "nameChangeDocuments"
  | "supportingDocuments";

export type LateDocument = {
  name: string;
  type: string;
  size: number;
  uploaded?: boolean;
  file?: File;
};

export const lateApplicationStatuses = [
  "Draft",
  "In Progress",
  "Documents Required",
  "Submitted",
  "Under Review",
  "Institution Submitted",
  "Awaiting Institution Feedback",
  "Accepted",
  "Rejected",
  "Completed"
] as const;

export type LateApplicationStatus = (typeof lateApplicationStatuses)[number];

export type LateApplicationData = {
  personal: {
    firstName: string;
    middleName: string;
    lastName: string;
    identityNumber: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    maritalStatus: string;
    disabilityStatus: string;
    disabilityDescription: string;
  };
  contact: {
    mobileNumber: string;
    alternativeNumber: string;
    emailAddress: string;
    residentialAddress: string;
    province: string;
    city: string;
    postalCode: string;
  };
  emergency: {
    fullName: string;
    relationship: string;
    contactNumber: string;
    alternativeContactNumber: string;
  };
  academic: {
    schoolName: string;
    examinationNumber: string;
    yearCompleted: string;
    currentEducationLevel: string;
    subjects: LateSubject[];
  };
  lateDetails: {
    appliedBefore: string;
    previousInstitution: string;
    previousApplicationYear: string;
    previousProgramme: string;
    reason: string;
    detailedExplanation: string;
  };
  institutions: LateInstitution[];
  guardian: {
    fullName: string;
    relationship: string;
    contactNumber: string;
    emailAddress: string;
    occupation: string;
  };
  documents: Partial<Record<LateDocumentKey, LateDocument>>;
  declarationAccepted: boolean;
};

export const latePackages: LatePackage[] = [
  {
    id: "late-basic",
    code: "LATE_BASIC",
    name: "Late Basic Package",
    price: 150,
    institutionLimit: 1,
    applicationType: "late",
    level: "BASIC",
    description: "Late application support for one institution.",
    highlight: "Single institution support",
    features: [
      "Late Application Processing",
      "Application Submission",
      "Status Tracking",
      "Document Checklist",
      "Email Notifications"
    ],
    suitableFor: "Applicants applying to a single institution."
  },
  {
    id: "late-standard",
    code: "LATE_STANDARD",
    name: "Late Standard Package",
    price: 250,
    institutionLimit: 3,
    applicationType: "late",
    level: "STANDARD",
    description: "Multiple late applications with document verification and progress updates.",
    highlight: "Multiple admission opportunities",
    badge: "Most Popular",
    features: [
      "Everything in Basic",
      "Multiple Institution Applications",
      "Document Verification",
      "Application Tracking",
      "Application Progress Updates"
    ],
    suitableFor: "Applicants wanting multiple admission opportunities."
  },
  {
    id: "late-premium",
    code: "LATE_PREMIUM",
    name: "Late Premium Package",
    price: 300,
    institutionLimit: 5,
    applicationType: "late",
    level: "PREMIUM",
    description: "Priority late application support with institution follow-ups.",
    highlight: "Priority processing and follow-ups",
    badge: "Best Support",
    features: [
      "Everything in Standard",
      "Priority Processing",
      "Institution Follow-Ups",
      "Faster Review",
      "Priority Support"
    ],
    suitableFor: "Applicants seeking the highest chance of admission."
  },
  {
    id: "late-vip",
    code: "LATE_VIP",
    name: "Late VIP Package",
    price: 330,
    institutionLimit: 8,
    applicationType: "late",
    level: "VIP",
    description: "Maximum institution coverage with dedicated manual assistance.",
    highlight: "Maximum institution coverage",
    features: [
      "Everything in Premium",
      "Dedicated Application Assistance",
      "Manual Application Monitoring",
      "Institution Follow-Ups",
      "Premium Support",
      "Maximum Institution Coverage"
    ],
    suitableFor: "Applicants applying broadly across many institutions."
  }
];

export const lateDocumentDefinitions: Array<{
  key: LateDocumentKey;
  label: string;
  required: boolean;
  category: string;
}> = [
  { key: "certifiedId", label: "Certified ID Copy", required: true, category: "id_document" },
  { key: "academicResults", label: "Latest Academic Results", required: true, category: "academic_results" },
  { key: "proofOfAddress", label: "Proof Of Address", required: true, category: "proof_of_address" },
  { key: "motivationLetter", label: "Motivation Letter", required: false, category: "motivation_letter" },
  { key: "medicalLetter", label: "Medical Letter", required: false, category: "medical_letter" },
  { key: "affidavit", label: "Affidavit", required: false, category: "affidavit" },
  { key: "nameChangeDocuments", label: "Name Change Documents", required: false, category: "name_change_documents" },
  { key: "supportingDocuments", label: "Supporting Documents", required: false, category: "supporting_documents" }
];

export const lateApplicationReasons = [
  "Awaiting Final Results",
  "Financial Difficulties",
  "Medical Reasons",
  "Family Emergency",
  "Missed Deadline",
  "Change Of Career Choice",
  "Change Of Institution",
  "Other"
];

export const educationLevels = ["Grade 12", "Completed Matric", "Certificate", "Diploma", "Degree", "Other"];
export const qualificationTypes = ["Higher Certificate", "Diploma", "Degree", "Advanced Diploma"];
export const programmePriorities = ["First Choice", "Second Choice", "Third Choice"];

export function createLateSubject(): LateSubject {
  return {
    id: `subject-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    mark: "",
    percentage: ""
  };
}

export function createLateInstitution(): LateInstitution {
  return {
    id: `late-institution-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    institutionName: "",
    campus: "",
    faculty: "",
    qualificationType: "",
    programme: "",
    intakeYear: String(new Date().getFullYear() + 1),
    intakeSemester: "",
    programmePriority: ""
  };
}

export function createEmptyLateApplication(user: KagieUser): LateApplicationData {
  const names = String(user.fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    personal: {
      firstName: names[0] || "",
      middleName: names.length > 2 ? names.slice(1, -1).join(" ") : "",
      lastName: names.length > 1 ? names[names.length - 1] || "" : "",
      identityNumber: "",
      dateOfBirth: "",
      gender: "",
      nationality: "",
      maritalStatus: "",
      disabilityStatus: "No",
      disabilityDescription: ""
    },
    contact: {
      mobileNumber: user.phone || "",
      alternativeNumber: "",
      emailAddress: user.email || "",
      residentialAddress: "",
      province: "",
      city: "",
      postalCode: ""
    },
    emergency: {
      fullName: "",
      relationship: "",
      contactNumber: "",
      alternativeContactNumber: ""
    },
    academic: {
      schoolName: "",
      examinationNumber: "",
      yearCompleted: "",
      currentEducationLevel: "",
      subjects: [createLateSubject()]
    },
    lateDetails: {
      appliedBefore: "",
      previousInstitution: "",
      previousApplicationYear: "",
      previousProgramme: "",
      reason: "",
      detailedExplanation: ""
    },
    institutions: [],
    guardian: {
      fullName: "",
      relationship: "",
      contactNumber: "",
      emailAddress: "",
      occupation: ""
    },
    documents: {},
    declarationAccepted: false
  };
}

export function calculateLateAverage(subjects: LateSubject[]) {
  const percentages = subjects
    .map((subject) => Number(subject.percentage))
    .filter((percentage) => Number.isFinite(percentage) && percentage >= 0 && percentage <= 100);
  if (!percentages.length) return 0;
  return Math.round((percentages.reduce((sum, percentage) => sum + percentage, 0) / percentages.length) * 100) / 100;
}

export function getMissingLateDocuments(documents: LateApplicationData["documents"]) {
  return lateDocumentDefinitions
    .filter((definition) => definition.required && !documents[definition.key]?.file && !documents[definition.key]?.uploaded)
    .map((definition) => definition.label);
}

export function getLatePackageLimitLabel(applicationPackage: Pick<LatePackage, "institutionLimit">) {
  const limit = applicationPackage.institutionLimit;
  return limit === "unlimited" ? "Unlimited institutions" : `${limit} institution${limit === 1 ? "" : "s"}`;
}

export function isWithinLatePackageLimit(applicationPackage: Pick<LatePackage, "institutionLimit">, count: number) {
  return applicationPackage.institutionLimit === "unlimited" || count <= applicationPackage.institutionLimit;
}

export function isAtLatePackageLimit(applicationPackage: Pick<LatePackage, "institutionLimit">, count: number) {
  return applicationPackage.institutionLimit !== "unlimited" && count >= applicationPackage.institutionLimit;
}

export function lateApplicationStorageKey(userId: string) {
  return `kagie_late_application_v2_${userId}`;
}

export function lateApplicationStepStorageKey(userId: string) {
  return `${lateApplicationStorageKey(userId)}_step`;
}
