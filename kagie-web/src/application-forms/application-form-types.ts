export const applicationTypes = [
  {
    id: "undergraduate",
    label: "Undergraduate Applications",
    description: "Apply for undergraduate programmes."
  },
  {
    id: "late",
    label: "Late Applications",
    description: "Apply where late application spaces are available."
  },
  {
    id: "transfer",
    label: "Transfer Applications",
    description: "Start an application to transfer institutions or programmes."
  },
  {
    id: "bridging",
    label: "Bridging Programmes",
    description: "Apply for a bridging or access programme."
  },
  {
    id: "postgraduate",
    label: "Postgraduate Applications",
    description: "Apply for postgraduate study."
  }
] as const;

export type ApplicationType = (typeof applicationTypes)[number]["id"];

const validApplicationTypes = new Set<ApplicationType>(applicationTypes.map((applicationType) => applicationType.id));

function storageKey(userId: string) {
  return `kagie_application_type_${userId}`;
}

export function readSelectedApplicationType(userId: string): ApplicationType | null {
  try {
    const savedType = localStorage.getItem(storageKey(userId));
    return savedType && validApplicationTypes.has(savedType as ApplicationType)
      ? (savedType as ApplicationType)
      : null;
  } catch {
    return null;
  }
}

export function saveSelectedApplicationType(userId: string, applicationType: ApplicationType) {
  try {
    localStorage.setItem(storageKey(userId), applicationType);
  } catch {
    // The current selection still works when browser storage is unavailable.
  }
}
