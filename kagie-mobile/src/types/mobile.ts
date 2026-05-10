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

export type CatalogInstitution = {
  id: string;
  name: string;
  province: string;
  type: string;
  applicationDeadline: string;
  status?: "open" | "closing_soon" | "closed";
  isActive?: boolean;
  faculties: Array<{
    name: string;
    courses: string[];
  }>;
};

export type ProspectusCard = {
  id: string;
  institution: string;
  shortName: string;
  province: string;
  type: string;
  year: string;
  summary: string;
  applicationDeadline: string;
};

export type UpdateCard = {
  id: string;
  category: "announcement" | "recommendation" | "deadline" | "service";
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

export type ExtraService = {
  id: string;
  name: string;
  slug: string;
  price: number;
  description: string;
};

export type MobileCatalog = {
  packs: ApplicationPack[];
  provinces: string[];
  schoolTypes: string[];
  homeLanguages: string[];
  subjects: string[];
  paymentMethods: PaymentRecord["method"][];
  institutionTypes: string[];
  institutions: CatalogInstitution[];
  services: ExtraService[];
  updates: UpdateCard[];
  prospectus: ProspectusCard[];
};

export type DashboardSummary = {
  latestApplication: ApplicationRecord;
  pack: ApplicationPack | null;
  readiness: number;
  pendingTasks: string[];
  notifications: NotificationRecord[];
  unreadCount: number;
  supportStatus: "open" | "resolved";
  quickStats: {
    institutions: number;
    subjects: number;
    packageAmount: number;
  };
};

export type CartSummary = {
  applicationId: string | null;
  pack: ApplicationPack | null;
  institutions: InstitutionChoice[];
  total: number;
  canCheckout: boolean;
  paymentStatus: string;
  status: string;
};

export type SupportSnapshot = {
  thread: SupportThreadRecord;
  messages: SupportMessageRecord[];
  callbacks: CallbackRequestRecord[];
};

export type ProfileSnapshot = {
  user: UserRecord;
  learner: ApplicationFormsSnapshot["learner"];
  parent: ApplicationFormsSnapshot["parent"];
  school: ApplicationFormsSnapshot["school"];
  marks: ApplicationMark[];
  latestApplication: ApplicationRecord;
};

export type CheckoutInput = {
  payerName: string;
  phone: string;
  reference: string;
  method: PaymentRecord["method"];
  note?: string;
};

export type InstitutionInput = Omit<InstitutionChoice, "id">;

export type ConnectionStatus = "online" | "offline" | "weak" | "syncing" | "restored" | "queued";

export type MobileConnectionState = {
  status: ConnectionStatus;
  latencyMs: number | null;
  lastCheckedAt: string;
  lastSuccessfulSyncAt: string;
  cacheSavedAt: string;
  pendingSyncCount: number;
};

export type DashboardSectionLoading = {
  summary: boolean;
  applications: boolean;
  deadlines: boolean;
  notifications: boolean;
  accommodation: boolean;
  recommendations: boolean;
  support: boolean;
  profile: boolean;
  documents: boolean;
};
