"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOUTH_AFRICAN_PROVINCES = exports.CALLBACK_STATUSES = exports.DOCUMENT_STATUSES = exports.PAYMENT_STATUSES = exports.APPLICATION_STATUSES = exports.ROLES = void 0;
exports.ROLES = {
    USER: "user",
    ASSISTANT_ADMIN: "assistant_admin",
    MASTER_ADMIN: "master_admin"
};
exports.APPLICATION_STATUSES = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    MISSING_DOCUMENTS: "Missing Documents",
    READY_TO_APPLY: "Ready to Apply",
    APPLIED: "Applied",
    PENDING_FEEDBACK: "Pending Feedback",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    PROCESSING: "Application being processed"
};
exports.PAYMENT_STATUSES = {
    PAYMENT_PENDING: "Payment Pending",
    PENDING_VERIFICATION: "Pending Verification",
    VERIFIED: "Verified"
};
exports.DOCUMENT_STATUSES = {
    PENDING_REVIEW: "Pending Review",
    APPROVED: "Approved",
    REJECTED: "Rejected"
};
exports.CALLBACK_STATUSES = {
    PENDING: "Pending",
    CONTACTED: "Contacted",
    RESOLVED: "Resolved"
};
exports.SOUTH_AFRICAN_PROVINCES = [
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
