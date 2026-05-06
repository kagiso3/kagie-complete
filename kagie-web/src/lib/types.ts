import type { ApplicationMark, ApplicationPack, InstitutionChoice } from "@kagie/shared";

export type RouteKey =
  | "login"
  | "signup"
  | "home"
  | "apply"
  | "cart"
  | "checkout"
  | "dashboard"
  | "accommodation"
  | "transport";

export type ProtectedRouteKey = Exclude<RouteKey, "login" | "signup">;

export interface KagieUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  source?: string;
  profileImage?: string;
  [key: string]: unknown;
}

export interface KagieProfile {
  idNumber?: string;
  surname?: string;
  maidenName?: string;
  dob?: string;
  gender?: string;
  homeLanguage?: string;
  province?: string;
  postalCode?: string;
  address?: string;
  fullNames?: string;
  cellphone?: string;
  email?: string;
  schoolName?: string;
  confirmName?: string;
  schoolProvince?: string;
  schoolType?: string;
  completionYear?: string;
  average?: number | string;
  relation?: string;
  guardianRelation?: string;
  guardianId?: string;
  guardianFullNames?: string;
  guardianSurname?: string;
  guardianCell1?: string;
  guardianCell2?: string;
  guardianEmail?: string;
  guardianProvince?: string;
  guardianPostal?: string;
  guardianAddress?: string;
  [key: string]: unknown;
}

export interface KagieFaculty {
  name: string;
  courses: string[];
  qualificationTypes?: string[];
}

export interface KagieInstitution {
  id: string;
  name: string;
  province: string;
  type: string;
  year: string;
  status: "open" | "closing_soon" | "closed" | string;
  openingDate?: string;
  closingDate?: string;
  canApply?: boolean;
  faculties?: KagieFaculty[];
  [key: string]: unknown;
}

export interface KagieFavorite {
  id: string;
  type: "institution" | "course" | string;
  institutionId?: string;
  institutionName?: string;
  course?: string;
  faculty?: string;
  province?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface KagieCartItem {
  id: string;
  type: string;
  name?: string;
  price?: number;
  quantity?: number;
  packName?: string;
  packPrice?: number;
  institutionLimit?: number | "unlimited";
  institutionCount?: number;
  institutions?: InstitutionChoice[];
  serviceName?: string;
  serviceCode?: string;
  [key: string]: unknown;
}

export interface KagiePayment {
  payerName?: string;
  phone?: string;
  reference?: string;
  note?: string;
  method?: string;
  amount?: number;
  status?: string;
  proofDocumentId?: string;
  proofFileName?: string;
  proofUploadedAt?: string;
  rejectionReason?: string;
  verificationNote?: string;
  verifiedAt?: string;
  reviewedAt?: string;
  [key: string]: unknown;
}

export interface KagieApplication {
  id: string;
  userId?: string;
  status?: string;
  paymentStatus?: string;
  package?: ApplicationPack | null;
  forms?: {
    learner?: Record<string, unknown>;
    parent?: Record<string, unknown>;
    school?: Record<string, unknown>;
    marks?: { subjects?: ApplicationMark[] };
    [key: string]: unknown;
  };
  institutions?: InstitutionChoice[];
  marks?: ApplicationMark[];
  payment?: KagiePayment | null;
  timeline?: Array<{ title?: string; status?: string; createdAt?: string }>;
  submittedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface KagieReminder {
  title?: string;
  message?: string;
  route?: string;
  tone?: string;
}

export interface KagieDashboardSummary {
  latestApplication?: KagieApplication | null;
  applications: KagieApplication[];
  readiness?: number;
  unreadNotifications?: number;
  smartAlerts?: string[];
  pendingTasks?: string[];
  reminders?: KagieReminder[];
  favorites?: KagieFavorite[];
  serviceRequests?: Array<Record<string, unknown>>;
  packageUsage?: {
    packageName?: string;
    institutionLimit?: number | "unlimited";
    usedSlots?: number;
    remainingSlots?: number;
  };
  recommendations?: {
    aps?: { total?: number; withLifeOrientation?: number };
    safeAlternatives?: Array<{ course: string; institutionName: string }>;
    warnings?: string[];
  };
  notifications?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  reviews?: Array<Record<string, unknown>>;
  deadlines?: Array<Record<string, unknown>>;
  notes?: Array<Record<string, unknown>>;
  journeyBoard?: Array<Record<string, unknown>>;
  priorityActions?: Array<Record<string, unknown>>;
  serviceOverview?: Record<string, number>;
  acceptanceChecklist?: {
    unlocked?: boolean;
    completed?: number;
    total?: number;
    items?: Array<Record<string, unknown>>;
  };
  preferences?: {
    lowDataMode?: boolean;
    reducedMotion?: boolean;
    compactDashboard?: boolean;
    connectionMode?: string;
  };
  [key: string]: unknown;
}

export interface KagieSettings {
  appName?: string;
  supportPhone?: string;
  supportEmail?: string;
  payments?: {
    merchantName?: string;
    bankName?: string;
    accountNumber?: string;
    accountType?: string;
    branchCode?: string;
    referencePrefix?: string;
    verificationMessage?: string;
  };
  [key: string]: unknown;
}

export interface AccommodationListing {
  id: string;
  propertyName: string;
  location: string;
  price: number;
  distanceFromCampus: string;
  roomType: string;
  availabilityStatus: string;
  images?: string[];
  institutionName?: string;
  providerName?: string;
  [key: string]: unknown;
}

export interface TransportOption {
  id: string;
  company: string;
  departureCity: string;
  destinationCity: string;
  optionName?: string;
  supportFee?: number;
  departureTime?: string;
  [key: string]: unknown;
}

export interface LegacyApi {
  currentUser: () => KagieUser | null;
  restoreSession: () => Promise<KagieUser | null>;
  requireRole: (role: string | string[]) => KagieUser;
  login: (email: string, password: string) => Promise<KagieUser>;
  registerUser: (payload: Record<string, unknown>) => Promise<KagieUser>;
  logout: () => Promise<void>;
  signInWithGoogle?: () => Promise<unknown>;
  signInWithApple?: () => Promise<unknown>;
  requestPasswordReset?: (email: string) => Promise<unknown>;
  getSettings?: () => KagieSettings;
  getPackCatalog: () => ApplicationPack[];
  getInstitutionYears: () => string[];
  getInstitutionCatalog: (filters?: Record<string, unknown>) => KagieInstitution[];
  getSubjectCatalog: (board?: string) => string[];
  getHighSchoolCatalog: (filters?: Record<string, unknown>) => Array<Record<string, unknown>>;
  getFavorites: (userId?: string) => KagieFavorite[];
  getFavoritesAsync?: (userId?: string) => Promise<KagieFavorite[]>;
  addFavorite: (entry: Record<string, unknown>, userId?: string) => KagieFavorite;
  addFavoriteAsync?: (entry: Record<string, unknown>, userId?: string) => Promise<KagieFavorite>;
  removeFavorite: (favoriteId: string, userId?: string) => KagieFavorite[];
  removeFavoriteAsync?: (favoriteId: string, userId?: string) => Promise<KagieFavorite[]>;
  calculateAps: (subjects: ApplicationMark[]) => { total?: number; withLifeOrientation?: number };
  calculateNscLevel?: (percent: number) => number;
  getApplicationRecommendations: (input: Record<string, unknown>) => KagieDashboardSummary["recommendations"];
  getProfile?: (userId?: string) => KagieProfile;
  getProfileAsync?: (userId?: string) => Promise<KagieProfile>;
  saveProfile?: (userId: string, patch: Record<string, unknown>) => KagieProfile;
  saveProfileAsync?: (userId: string, patch: Record<string, unknown>) => Promise<KagieProfile>;
  ensureDraft: (userId?: string) => KagieApplication;
  ensureDraftAsync?: (userId?: string) => Promise<KagieApplication>;
  updateApplication?: (appId: string, patch: Record<string, unknown>) => KagieApplication;
  updateApplicationAsync?: (appId: string, patch: Record<string, unknown>) => Promise<KagieApplication>;
  saveFormSection: (sectionName: string, data: Record<string, unknown>, appId?: string) => KagieApplication;
  saveFormSectionAsync?: (sectionName: string, data: Record<string, unknown>, appId?: string) => Promise<KagieApplication>;
  addInstitutionToDraft: (institution: Record<string, unknown>, appId?: string) => KagieApplication;
  addInstitutionToDraftAsync?: (institution: Record<string, unknown>, appId?: string) => Promise<KagieApplication>;
  removeInstitutionFromDraft?: (institutionId: string, appId?: string) => KagieApplication;
  removeInstitutionFromDraftAsync?: (institutionId: string, appId?: string) => Promise<KagieApplication>;
  getCart: (userId?: string) => KagieCartItem[];
  getCartAsync?: (userId?: string) => Promise<KagieCartItem[]>;
  addCartItem: (item: Record<string, unknown>, userId?: string) => KagieCartItem;
  addCartItemAsync?: (item: Record<string, unknown>, userId?: string) => Promise<KagieCartItem>;
  removeCartItem: (itemId: string, userId?: string) => KagieCartItem[];
  removeCartItemAsync?: (itemId: string, userId?: string) => Promise<KagieCartItem[]>;
  clearCart: (userId?: string) => boolean;
  clearCartAsync?: (userId?: string) => Promise<boolean>;
  getCartTotal: (userId?: string) => number;
  getCartTotalAsync?: (userId?: string) => Promise<number>;
  submitPayment?: (payment: Record<string, unknown>) => KagieApplication;
  submitApplicationFromCart?: (payment: Record<string, unknown>) => KagieApplication;
  submitApplicationFromCartAsync?: (payment: Record<string, unknown>) => Promise<KagieApplication>;
  saveDocuments?: (filesMeta: Record<string, unknown>, userId?: string) => unknown;
  saveDocumentsAsync?: (filesMeta: Record<string, unknown>, userId?: string) => Promise<unknown>;
  getDashboardSummary: (userId?: string) => KagieDashboardSummary;
  getDashboardSummaryAsync?: (userId?: string) => Promise<KagieDashboardSummary>;
  getAccommodationListings?: () => AccommodationListing[];
  getAccommodationListingsAsync?: () => Promise<AccommodationListing[]>;
  submitAccommodationRequest?: (payload: Record<string, unknown>, userId?: string) => unknown;
  submitAccommodationRequestAsync?: (payload: Record<string, unknown>, userId?: string) => Promise<unknown>;
  getTransportOptions?: () => TransportOption[];
  getTransportOptionsAsync?: () => Promise<TransportOption[]>;
  submitTransportRequest?: (payload: Record<string, unknown>, userId?: string) => unknown;
  submitTransportRequestAsync?: (payload: Record<string, unknown>, userId?: string) => Promise<unknown>;
}
