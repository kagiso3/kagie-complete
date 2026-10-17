import type { ApplicationPack } from "@kagie/shared";
import type { ApplicationDocumentKey, ApplicationStatus } from "./application-form-model";

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const supportedDocumentExtensions = new Set(["pdf", "jpg", "jpeg", "png"]);
const supportedDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const documentCategories: Record<ApplicationDocumentKey, string> = {
  identityDocument: "id_document",
  academicResults: "academic_results",
  cv: "cv",
  researchProposal: "research_proposal",
  supportingDocuments: "supporting_documents",
  academicTranscript: "academic_transcript",
  studentRecord: "student_record",
  qualificationCertificate: "qualification_certificate",
  recommendationLetters: "recommendation_letters"
};

export type DocumentFileMetadata = {
  name: string;
  type: string;
  size: number;
};

export function isWithinInstitutionLimit(pack: ApplicationPack, count: number) {
  return pack.institutionLimit === "unlimited" || count <= pack.institutionLimit;
}

export function getStepProgress(step: number, totalSteps: number) {
  if (totalSteps <= 1) return 100;
  const boundedStep = Math.max(0, Math.min(step, totalSteps - 1));
  return Math.round((boundedStep / (totalSteps - 1)) * 100);
}

export function getBackendApplicationStatus(progressStatus: ApplicationStatus) {
  return progressStatus === "Submitted" ? "Submitted" : "Draft";
}

export function getDocumentCategory(key: ApplicationDocumentKey) {
  return documentCategories[key];
}

export function validateDocumentFile(file: DocumentFileMetadata) {
  if (!file.size) return "The selected file is empty.";
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) return "The selected file is larger than 10 MB.";

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const supportedType = !file.type || supportedDocumentTypes.has(file.type.toLowerCase());
  if (!supportedDocumentExtensions.has(extension) || !supportedType) {
    return "Upload a PDF, JPG, JPEG, or PNG file.";
  }
  return "";
}
