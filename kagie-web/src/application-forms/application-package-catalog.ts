import type { ApplicationPack } from "@kagie/shared";
import type { ApplicationType } from "./application-form-types";

export type ApplicationPackageSelection = {
  applicationType: ApplicationType;
  package: ApplicationPack;
  packagePrice: number;
  finalTotal: number;
  applicationId?: string;
  savedAt: string;
};

export const applicationTypeLabels: Record<ApplicationType, string> = {
  undergraduate: "Undergraduate Applications",
  late: "Late Applications",
  postgraduate: "Postgraduate Applications",
  bridging: "Bridging Programmes",
  transfer: "Transfer Applications"
};

export function normalizeApplicationTypeKey(value: unknown): ApplicationType | "" {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!key) return "";
  if (["undergrad", "under_graduate", "undergraduate", "undergraduate_application", "undergraduate_applications", "under_graduate_application", "under_graduate_applications"].includes(key)) {
    return "undergraduate";
  }
  if (["late", "late_application", "late_applications"].includes(key)) return "late";
  if (["bridging", "bridge", "bridging_programme", "bridging_programmes"].includes(key)) return "bridging";
  if (["postgraduate", "post_graduate", "postgraduate_application", "postgraduate_applications", "post_graduate_application", "post_graduate_applications", "post_grad", "postgrad"].includes(key)) {
    return "postgraduate";
  }
  if (["transfer", "transfer_application", "transfer_applications"].includes(key)) return "transfer";
  return "";
}

function packageApplicationType(applicationPackage: ApplicationPack): ApplicationType {
  const source = applicationPackage as ApplicationPack & { application_type?: string };
  return normalizeApplicationTypeKey(source.applicationType || source.application_type) || "undergraduate";
}

export function packageMatchesApplicationType(applicationPackage: ApplicationPack, applicationType: ApplicationType) {
  return packageApplicationType(applicationPackage) === applicationType;
}

export function getApplicationPackagesForType(packages: ApplicationPack[], applicationType: ApplicationType) {
  return packages.filter((applicationPackage) => packageMatchesApplicationType(applicationPackage, applicationType));
}

function selectionKey(userId: string, applicationType: ApplicationType) {
  return `kagie_application_package_v2_${userId}_${applicationType}`;
}

function isPackageSelection(value: unknown, applicationType: ApplicationType): value is ApplicationPackageSelection {
  if (!value || typeof value !== "object") return false;
  const selection = value as Partial<ApplicationPackageSelection>;
  const selectedPackage = selection.package as Partial<ApplicationPack> | undefined;
  return selection.applicationType === applicationType
    && Boolean(selectedPackage?.id)
    && Boolean(selectedPackage?.name)
    && Number.isFinite(Number(selectedPackage?.price))
    && (selectedPackage?.institutionLimit === "unlimited" || Number.isFinite(Number(selectedPackage?.institutionLimit)));
}

export function buildPackageSelection(
  applicationType: ApplicationType,
  applicationPackage: ApplicationPack,
  applicationId?: string
): ApplicationPackageSelection {
  return {
    applicationType,
    package: applicationPackage,
    packagePrice: applicationPackage.price,
    finalTotal: applicationPackage.price,
    applicationId,
    savedAt: new Date().toISOString()
  };
}

export function readPackageSelection(userId: string, applicationType: ApplicationType) {
  try {
    const stored = localStorage.getItem(selectionKey(userId, applicationType));
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isPackageSelection(parsed, applicationType) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePackageSelection(userId: string, selection: ApplicationPackageSelection) {
  try {
    localStorage.setItem(selectionKey(userId, selection.applicationType), JSON.stringify(selection));
  } catch {
    // The active form keeps the selection when browser storage is unavailable.
  }
}
