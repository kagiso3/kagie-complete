import { ROLES, type UserRecord } from "@kagie/shared";

export const OFFLINE_GUEST_ID = "guest-local-kagie";
export const OFFLINE_GUEST_EMAIL = "offline@kagie.local";

export function createOfflineGuest(fullName = "Kagie Guest"): UserRecord {
  const timestamp = new Date().toISOString();
  return {
    id: OFFLINE_GUEST_ID,
    role: ROLES.USER,
    fullName: fullName.trim() || "Kagie Guest",
    email: OFFLINE_GUEST_EMAIL,
    phone: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function isOfflineGuest(user: UserRecord | null | undefined) {
  return user?.id === OFFLINE_GUEST_ID || user?.email === OFFLINE_GUEST_EMAIL;
}
