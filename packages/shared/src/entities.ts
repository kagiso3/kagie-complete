import type {
  ApplicationStatus,
  CallbackStatus,
  DocumentStatus,
  PaymentStatus,
  Role,
  SouthAfricanProvince
} from "./enums";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord extends BaseEntity {
  role: Role;
  fullName: string;
  email: string;
  phone: string;
}

export interface UserProfile {
  userId: string;
  idNumber: string;
  surname: string;
  maidenName?: string;
  dob?: string;
  gender?: string;
  homeLanguage?: string;
  province?: SouthAfricanProvince | "";
  postalCode?: string;
  address?: string;
  profileImage?: string;
}

export interface GuardianProfile {
  userId: string;
  relation?: string;
  guardianId?: string;
  fullNames?: string;
  surname?: string;
  phone1?: string;
  phone2?: string;
  email?: string;
  province?: SouthAfricanProvince | "";
  postalCode?: string;
  address?: string;
}

export interface SchoolProfile {
  userId: string;
  schoolName?: string;
  confirmName?: string;
  schoolProvince?: SouthAfricanProvince | "";
  schoolType?: string;
  completionYear?: string;
  average?: number | string;
}

export interface ApplicationMark {
  id: string;
  subject: string;
  percent: number;
  level: number;
}

export interface InstitutionChoice {
  id: string;
  province: string;
  institutionType: string;
  institutionName: string;
  faculty: string;
  choice1: string;
  choice2: string;
  choice3: string;
}

export interface ApplicationPack {
  id: string;
  name: string;
  price: number;
  institutionLimit: number | "unlimited";
  description: string;
  highlight: string;
}

export interface ApplicationFormsSnapshot {
  learner: Partial<UserProfile> & {
    fullNames?: string;
    cellphone?: string;
    email?: string;
  };
  parent: Partial<GuardianProfile>;
  school: Partial<SchoolProfile>;
  marks: {
    subjects: ApplicationMark[];
  };
}

export interface PaymentRecord extends BaseEntity {
  applicationId: string;
  payerName: string;
  phone: string;
  reference: string;
  method: "EFT" | "Cash Deposit" | "Card Transfer" | "Mobile Payment";
  note?: string;
  amount: number;
  status: PaymentStatus;
}

export interface ApplicationRecord extends BaseEntity {
  userId: string;
  assistantId?: string | null;
  packageId?: string | null;
  status: ApplicationStatus;
  paymentStatus: PaymentStatus;
  submittedAt?: string | null;
  forms: ApplicationFormsSnapshot;
  marks: ApplicationMark[];
  institutions: InstitutionChoice[];
  services: CartItemRecord[];
}

export interface CartItemRecord {
  id: string;
  type: "application_pack" | "service" | "institution" | "custom";
  name: string;
  price: number;
  quantity: number;
  refId?: string;
  meta?: Record<string, unknown>;
}

export interface DocumentRecord extends BaseEntity {
  userId: string;
  applicationId?: string | null;
  type: string;
  fileName: string;
  fileUrl: string;
  status: DocumentStatus;
}

export interface DocumentReviewRecord extends BaseEntity {
  documentId: string;
  assistantId: string;
  status: DocumentStatus;
  note?: string;
}

export interface NotificationRecord extends BaseEntity {
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
  read: boolean;
}

export interface SupportThreadRecord extends BaseEntity {
  userId: string;
  assistantId?: string | null;
  status: "open" | "resolved";
}

export interface SupportMessageRecord extends BaseEntity {
  threadId: string;
  senderId: string;
  senderRole: Role;
  message: string;
}

export interface CallbackRequestRecord extends BaseEntity {
  userId: string;
  phone: string;
  preferredTime?: string;
  note?: string;
  status: CallbackStatus;
  assignedAssistantId?: string | null;
}

export interface ApplicationNoteRecord extends BaseEntity {
  applicationId: string;
  authorId: string;
  authorRole: Role;
  note: string;
}

export interface AssistantActivityRecord extends BaseEntity {
  assistantId: string;
  applicationId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}
