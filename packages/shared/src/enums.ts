export const ROLES = {
  USER: "user",
  ASSISTANT_ADMIN: "assistant_admin",
  MASTER_ADMIN: "master_admin"
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const APPLICATION_STATUSES = {
  DRAFT: "Draft",
  PACKAGE_SELECTED: "Package Selected",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAID: "Paid",
  PENDING_DETAILS: "Pending Details",
  INCOMPLETE: "Incomplete",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  DOCUMENTS_REQUIRED: "Documents Required",
  DOCUMENTS_MISSING: "Documents Missing",
  MISSING_DOCUMENTS: "Missing Documents",
  INSTITUTION_SUBMITTED: "Institution Submitted",
  AWAITING_INSTITUTION_FEEDBACK: "Awaiting Institution Feedback",
  AWAITING_INSTITUTION_FEE: "Awaiting Institution Fee",
  SUBMITTED_TO_INSTITUTION: "Submitted to Institution",
  READY_TO_APPLY: "Ready to Apply",
  APPLIED: "Applied",
  PENDING_FEEDBACK: "Pending Feedback",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  PROCESSING: "Application being processed"
} as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[keyof typeof APPLICATION_STATUSES];

export const PAYMENT_STATUSES = {
  UNPAID: "Unpaid",
  PENDING: "Pending",
  PAID: "Paid",
  PAYMENT_PENDING: "Payment Pending",
  PENDING_VERIFICATION: "Pending Verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded"
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export const DOCUMENT_STATUSES = {
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected"
} as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[keyof typeof DOCUMENT_STATUSES];

export const CALLBACK_STATUSES = {
  PENDING: "Pending",
  CONTACTED: "Contacted",
  RESOLVED: "Resolved"
} as const;

export type CallbackStatus = (typeof CALLBACK_STATUSES)[keyof typeof CALLBACK_STATUSES];

export const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape"
] as const;

export type SouthAfricanProvince = (typeof SOUTH_AFRICAN_PROVINCES)[number];
