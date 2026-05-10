import type { ApplicationMark, ApplicationRecord, DocumentRecord } from "@kagie/shared";
import type {
  CartSummary,
  DashboardSummary,
  InstitutionInput,
  MobileCatalog,
  ProfileSnapshot,
  SupportSnapshot
} from "../types/mobile";
import { deleteDeviceValue, getDeviceJson, setDeviceJson } from "./storage";

export type DraftQueueItem =
  | { kind: "saveSection"; section: "learner" | "parent" | "school"; payload: Record<string, string | number | null> }
  | { kind: "saveMarks"; subjects: ApplicationMark[] }
  | { kind: "selectPackage"; packageId: string }
  | { kind: "addInstitution"; payload: InstitutionInput }
  | { kind: "removeInstitution"; institutionId: string };

export type MobileDataCache = {
  catalog: MobileCatalog | null;
  draft: ApplicationRecord | null;
  dashboard: DashboardSummary | null;
  cart: CartSummary | null;
  notifications: DashboardSummary["notifications"];
  support: SupportSnapshot | null;
  profile: ProfileSnapshot | null;
  documents: DocumentRecord[];
  savedAt: string;
};

const CACHE_PREFIX = "kagie_mobile_cache_v2";
const QUEUE_PREFIX = "kagie_mobile_draft_queue_v2";

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}_${userId}`;
}

function queueKey(userId: string) {
  return `${QUEUE_PREFIX}_${userId}`;
}

export function isLocalDraft(application: ApplicationRecord | null | undefined) {
  return Boolean(application?.id?.startsWith("local-"));
}

export function createLocalDraft(userId: string): ApplicationRecord {
  const timestamp = new Date().toISOString();
  return {
    id: `local-${userId}-${Date.now()}`,
    userId,
    assistantId: null,
    packageId: null,
    status: "Draft",
    paymentStatus: "Payment Pending",
    submittedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
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

export function applyDraftQueueItem(draft: ApplicationRecord, item: DraftQueueItem): ApplicationRecord {
  const timestamp = new Date().toISOString();
  if (item.kind === "saveSection") {
    return {
      ...draft,
      updatedAt: timestamp,
      forms: {
        ...draft.forms,
        [item.section]: {
          ...(draft.forms[item.section] || {}),
          ...item.payload
        }
      }
    };
  }

  if (item.kind === "saveMarks") {
    return {
      ...draft,
      updatedAt: timestamp,
      marks: item.subjects,
      forms: {
        ...draft.forms,
        marks: {
          subjects: item.subjects
        }
      }
    };
  }

  if (item.kind === "selectPackage") {
    return {
      ...draft,
      updatedAt: timestamp,
      packageId: item.packageId
    };
  }

  if (item.kind === "addInstitution") {
    return {
      ...draft,
      updatedAt: timestamp,
      institutions: [
        ...(draft.institutions || []),
        {
          ...item.payload,
          id: `local-institution-${Date.now()}`
        }
      ]
    };
  }

  return {
    ...draft,
    updatedAt: timestamp,
    institutions: (draft.institutions || []).filter((institution) => institution.id !== item.institutionId)
  };
}

export function applyDraftQueue(draft: ApplicationRecord, queue: DraftQueueItem[]) {
  return queue.reduce((nextDraft, item) => applyDraftQueueItem(nextDraft, item), draft);
}

export function saveMobileDataCache(userId: string, cache: Omit<MobileDataCache, "savedAt">) {
  return setDeviceJson<MobileDataCache>(cacheKey(userId), {
    ...cache,
    savedAt: new Date().toISOString()
  });
}

export function getMobileDataCache(userId: string) {
  return getDeviceJson<MobileDataCache>(cacheKey(userId));
}

export async function clearMobileDataCache(userId: string) {
  await deleteDeviceValue(cacheKey(userId));
}

export async function getDraftQueue(userId: string) {
  return (await getDeviceJson<DraftQueueItem[]>(queueKey(userId))) || [];
}

export async function queueDraftMutation(userId: string, item: DraftQueueItem) {
  const queue = await getDraftQueue(userId);
  const compacted = compactDraftQueue([...queue, item]);
  await setDeviceJson(queueKey(userId), compacted);
  return compacted;
}

export function clearDraftQueue(userId: string) {
  return deleteDeviceValue(queueKey(userId));
}

function compactDraftQueue(queue: DraftQueueItem[]) {
  const latestSections = new Map<string, DraftQueueItem>();
  const rest: DraftQueueItem[] = [];

  for (const item of queue) {
    if (item.kind === "saveSection") {
      latestSections.set(item.section, item);
      continue;
    }
    if (item.kind === "saveMarks") {
      latestSections.set("marks", item);
      continue;
    }
    if (item.kind === "selectPackage") {
      latestSections.set("package", item);
      continue;
    }
    rest.push(item);
  }

  return [...latestSections.values(), ...rest];
}
