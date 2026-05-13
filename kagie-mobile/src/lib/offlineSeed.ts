import type { ApplicationPack, ApplicationRecord, NotificationRecord, UserRecord } from "@kagie/shared";
import type { CartSummary, DashboardSummary, MobileCatalog, ProfileSnapshot, SupportSnapshot } from "../types/mobile";

const timestamp = () => new Date().toISOString();

export const offlinePacks: ApplicationPack[] = [
  {
    id: "offline-pack-starter",
    name: "Starter Application Pack",
    price: 0,
    institutionLimit: 3,
    description: "Prepare your first shortlist and application details offline.",
    highlight: "Offline ready"
  },
  {
    id: "offline-pack-guided",
    name: "Guided Support Pack",
    price: 250,
    institutionLimit: "unlimited",
    description: "Plan applications, documents, and support requests before syncing.",
    highlight: "Sync later"
  }
];

export function createOfflineDraft(userId: string): ApplicationRecord {
  const now = timestamp();
  return {
    id: `local-${userId}-draft`,
    userId,
    assistantId: null,
    packageId: offlinePacks[0].id,
    status: "Draft",
    paymentStatus: "Payment Pending",
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    forms: {
      learner: {},
      parent: {},
      school: {},
      marks: {
        subjects: []
      }
    },
    marks: [],
    institutions: [],
    services: []
  };
}

export function createOfflineCatalog(): MobileCatalog {
  return {
    packs: offlinePacks,
    provinces: ["Gauteng", "KwaZulu-Natal", "Western Cape", "Eastern Cape", "Limpopo", "Mpumalanga", "Free State", "North West", "Northern Cape"],
    schoolTypes: ["Public school", "Private school", "TVET college", "Other"],
    homeLanguages: ["English", "isiZulu", "isiXhosa", "Sepedi", "Setswana", "Afrikaans", "Sesotho", "Other"],
    subjects: ["Mathematics", "Mathematical Literacy", "Physical Sciences", "Life Sciences", "Accounting", "Business Studies", "Geography", "History", "English"],
    paymentMethods: ["EFT", "Cash Deposit", "Card Transfer", "Mobile Payment"],
    institutionTypes: ["University", "University of Technology", "TVET College"],
    institutions: [
      {
        id: "offline-uj",
        name: "University of Johannesburg",
        province: "Gauteng",
        type: "University",
        applicationDeadline: "2026-09-30",
        status: "open",
        isActive: true,
        faculties: [
          { name: "Commerce", courses: ["Accounting", "Business Management", "Economics"] },
          { name: "Engineering", courses: ["Electrical Engineering", "Civil Engineering", "Mechanical Engineering"] }
        ]
      },
      {
        id: "offline-tut",
        name: "Tshwane University of Technology",
        province: "Gauteng",
        type: "University of Technology",
        applicationDeadline: "2026-10-31",
        status: "open",
        isActive: true,
        faculties: [
          { name: "ICT", courses: ["Information Technology", "Computer Systems"] },
          { name: "Management Sciences", courses: ["Public Management", "Marketing"] }
        ]
      },
      {
        id: "offline-unisa",
        name: "University of South Africa",
        province: "Gauteng",
        type: "University",
        applicationDeadline: "2026-11-15",
        status: "closing_soon",
        isActive: true,
        faculties: [
          { name: "Education", courses: ["Foundation Phase Teaching", "Intermediate Phase Teaching"] },
          { name: "Law", courses: ["LLB", "Criminal Justice"] }
        ]
      }
    ],
    services: [
      {
        id: "offline-accommodation",
        name: "Accommodation assistance",
        slug: "accommodation-assistance",
        price: 120,
        description: "Prepare residence preferences and housing notes offline."
      },
      {
        id: "offline-documents",
        name: "Document checklist review",
        slug: "document-review",
        price: 80,
        description: "Track missing ID, results, proof of residence, and certificates."
      }
    ],
    updates: [
      {
        id: "offline-deadline",
        category: "deadline",
        title: "Application planning",
        body: "Use offline mode to prepare choices and documents before syncing.",
        ctaLabel: "Open draft",
        ctaHref: "apply"
      },
      {
        id: "offline-recommendation",
        category: "recommendation",
        title: "Shortlist safer options",
        body: "Choose at least one university, one university of technology, and one backup path.",
        ctaLabel: "View recommendations",
        ctaHref: "explore"
      }
    ],
    prospectus: [
      {
        id: "offline-prospectus-uj",
        institution: "University of Johannesburg",
        shortName: "UJ",
        province: "Gauteng",
        type: "University",
        year: "2026",
        summary: "Offline prospectus note. Confirm final requirements online before submitting.",
        applicationDeadline: "2026-09-30"
      }
    ]
  };
}

export function createOfflineNotification(userId: string): NotificationRecord {
  const now = timestamp();
  return {
    id: "offline-notification",
    userId,
    title: "Offline mode active",
    message: "Kagie is usable on this phone. Login, payments, uploads, and cloud sync need internet.",
    type: "info",
    read: false,
    createdAt: now,
    updatedAt: now
  };
}

export function createOfflineSnapshot(user: UserRecord, existingDraft?: ApplicationRecord | null) {
  const draft = existingDraft || createOfflineDraft(user.id);
  const notification = createOfflineNotification(user.id);
  const catalog = createOfflineCatalog();
  const dashboard: DashboardSummary = {
    latestApplication: draft,
    pack: offlinePacks[0],
    readiness: 35,
    pendingTasks: [
      "Complete learner details",
      "Add Grade 12 subjects",
      "Choose institutions",
      "Upload documents when internet is available"
    ],
    notifications: [notification],
    unreadCount: 1,
    supportStatus: "open",
    quickStats: {
      institutions: draft.institutions.length,
      subjects: draft.marks.length,
      packageAmount: offlinePacks[0].price
    }
  };
  const cart: CartSummary = {
    applicationId: draft.id,
    pack: offlinePacks[0],
    institutions: draft.institutions,
    total: 0,
    canCheckout: false,
    paymentStatus: draft.paymentStatus,
    status: draft.status
  };
  const support: SupportSnapshot = {
    thread: {
      id: `local-thread-${user.id}`,
      userId: user.id,
      assistantId: null,
      status: "open",
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt
    },
    messages: [],
    callbacks: []
  };
  const profile: ProfileSnapshot = {
    user,
    learner: {
      fullNames: user.fullName,
      email: user.email
    },
    parent: {},
    school: {},
    marks: [],
    latestApplication: draft
  };

  return {
    catalog,
    draft,
    dashboard,
    cart,
    notifications: [notification],
    support,
    profile,
    documents: []
  };
}
