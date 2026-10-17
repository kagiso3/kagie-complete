import type { KagieUser } from "../lib/types";
import type { ApplicationType } from "./application-form-types";

export type ApplicationStatus =
  | "Draft"
  | "In Progress"
  | "Documents Required"
  | "Submitted"
  | "Under Review"
  | "Institution Submitted"
  | "Awaiting Institution Feedback"
  | "Accepted"
  | "Rejected"
  | "Completed";

export type PersonalDetails = {
  firstName: string;
  middleName: string;
  lastName: string;
  identityNumber: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  maritalStatus: string;
};

export type ContactDetails = {
  mobileNumber: string;
  alternativeNumber: string;
  emailAddress: string;
  physicalAddress: string;
  postalAddress: string;
  province: string;
  city: string;
};

export type EmergencyContact = {
  fullName: string;
  relationship: string;
  phoneNumber: string;
};

export type AcademicInformation = {
  highestQualification: string;
  schoolName: string;
  examinationNumber: string;
  yearCompleted: string;
  subjects: string;
  results: string;
};

export type InstitutionSelection = {
  id: string;
  institutionName: string;
  campus: string;
  programme: string;
  qualificationType: string;
  intakeYear: string;
  intakeSemester: string;
};

export type ApplicationDocumentKey =
  | "identityDocument"
  | "academicResults"
  | "cv"
  | "researchProposal"
  | "supportingDocuments"
  | "academicTranscript"
  | "studentRecord"
  | "qualificationCertificate"
  | "recommendationLetters";

export type ApplicationDocument = {
  name: string;
  type: string;
  size: number;
  uploaded?: boolean;
  file?: File;
};

export type ApplicationFormData = {
  personalDetails: PersonalDetails;
  contactDetails: ContactDetails;
  emergencyContact: EmergencyContact;
  academicInformation: AcademicInformation;
  institutions: InstitutionSelection[];
  documents: Partial<Record<ApplicationDocumentKey, ApplicationDocument>>;
  typeSpecific: Record<string, string>;
};

export type ApplicationProgress = {
  percentage: number;
  currentStep: string;
  currentStepNumber: number;
  totalSteps: number;
  missingDocuments: string[];
  status: ApplicationStatus;
};

export type TypeSpecificField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "textarea" | "number" | "email" | "tel";
};

export const applicationStatuses: ApplicationStatus[] = [
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
];

export type ApplicationDocumentDefinition = {
  key: ApplicationDocumentKey;
  label: string;
  required: boolean;
};

export function createEmptyApplicationForm(user: KagieUser): ApplicationFormData {
  const names = String(user.fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    personalDetails: {
      firstName: names[0] || "",
      middleName: names.length > 2 ? names.slice(1, -1).join(" ") : "",
      lastName: names.length > 1 ? (names[names.length - 1] || "") : "",
      identityNumber: "",
      dateOfBirth: "",
      gender: "",
      nationality: "",
      maritalStatus: ""
    },
    contactDetails: {
      mobileNumber: user.phone || "",
      alternativeNumber: "",
      emailAddress: user.email || "",
      physicalAddress: "",
      postalAddress: "",
      province: "",
      city: ""
    },
    emergencyContact: {
      fullName: "",
      relationship: "",
      phoneNumber: ""
    },
    academicInformation: {
      highestQualification: "",
      schoolName: "",
      examinationNumber: "",
      yearCompleted: "",
      subjects: "",
      results: ""
    },
    institutions: [],
    documents: {},
    typeSpecific: {}
  };
}

export function createInstitutionSelection(): InstitutionSelection {
  return {
    id: `institution-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    institutionName: "",
    campus: "",
    programme: "",
    qualificationType: "",
    intakeYear: String(new Date().getFullYear() + 1),
    intakeSemester: ""
  };
}

export function getMissingDocuments(
  documents: ApplicationFormData["documents"],
  definitions: ApplicationDocumentDefinition[]
) {
  const required = definitions.filter((document) => document.required).map((document) => document.key);
  return required.filter((key) => !documents[key]?.file && !documents[key]?.uploaded);
}

export function applicationStorageKey(userId: string, applicationType: ApplicationType) {
  return `kagie_application_form_v1_${userId}_${applicationType}`;
}

export function applicationStepStorageKey(userId: string, applicationType: ApplicationType) {
  return `${applicationStorageKey(userId, applicationType)}_step`;
}

export function clearApplicationStorage(userId: string, applicationType: ApplicationType) {
  try {
    localStorage.removeItem(applicationStorageKey(userId, applicationType));
    localStorage.removeItem(applicationStepStorageKey(userId, applicationType));
  } catch {
    // A submitted application is still complete when browser storage is unavailable.
  }
}
