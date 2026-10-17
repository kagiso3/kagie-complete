export declare const ROLES: {
    readonly USER: "user";
    readonly ASSISTANT_ADMIN: "assistant_admin";
    readonly MASTER_ADMIN: "master_admin";
};
export type Role = (typeof ROLES)[keyof typeof ROLES];
export declare const APPLICATION_STATUSES: {
    readonly DRAFT: "Draft";
    readonly PACKAGE_SELECTED: "Package Selected";
    readonly AWAITING_PAYMENT: "Awaiting Payment";
    readonly PAID: "Paid";
    readonly PENDING_DETAILS: "Pending Details";
    readonly INCOMPLETE: "Incomplete";
    readonly SUBMITTED: "Submitted";
    readonly UNDER_REVIEW: "Under Review";
    readonly DOCUMENTS_REQUIRED: "Documents Required";
    readonly DOCUMENTS_MISSING: "Documents Missing";
    readonly MISSING_DOCUMENTS: "Missing Documents";
    readonly INSTITUTION_SUBMITTED: "Institution Submitted";
    readonly AWAITING_INSTITUTION_FEEDBACK: "Awaiting Institution Feedback";
    readonly AWAITING_INSTITUTION_FEE: "Awaiting Institution Fee";
    readonly SUBMITTED_TO_INSTITUTION: "Submitted to Institution";
    readonly READY_TO_APPLY: "Ready to Apply";
    readonly APPLIED: "Applied";
    readonly PENDING_FEEDBACK: "Pending Feedback";
    readonly ACCEPTED: "Accepted";
    readonly REJECTED: "Rejected";
    readonly COMPLETED: "Completed";
    readonly CANCELLED: "Cancelled";
    readonly PROCESSING: "Application being processed";
};
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[keyof typeof APPLICATION_STATUSES];
export declare const PAYMENT_STATUSES: {
    readonly UNPAID: "Unpaid";
    readonly PENDING: "Pending";
    readonly PAID: "Paid";
    readonly PAYMENT_PENDING: "Payment Pending";
    readonly PENDING_VERIFICATION: "Pending Verification";
    readonly VERIFIED: "Verified";
    readonly REJECTED: "Rejected";
    readonly FAILED: "Failed";
    readonly CANCELLED: "Cancelled";
    readonly REFUNDED: "Refunded";
};
export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];
export declare const DOCUMENT_STATUSES: {
    readonly PENDING_REVIEW: "Pending Review";
    readonly APPROVED: "Approved";
    readonly REJECTED: "Rejected";
};
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[keyof typeof DOCUMENT_STATUSES];
export declare const CALLBACK_STATUSES: {
    readonly PENDING: "Pending";
    readonly CONTACTED: "Contacted";
    readonly RESOLVED: "Resolved";
};
export type CallbackStatus = (typeof CALLBACK_STATUSES)[keyof typeof CALLBACK_STATUSES];
export declare const SOUTH_AFRICAN_PROVINCES: readonly ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];
export type SouthAfricanProvince = (typeof SOUTH_AFRICAN_PROVINCES)[number];
//# sourceMappingURL=enums.d.ts.map