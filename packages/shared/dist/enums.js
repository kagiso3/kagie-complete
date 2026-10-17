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
};
exports.PAYMENT_STATUSES = {
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
