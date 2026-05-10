import { deleteDeviceValue, getDeviceJson, setDeviceJson } from "./storage";

export type PendingMobileAction =
  | { kind: "markNotificationRead"; notificationId: string; createdAt: string }
  | { kind: "sendSupportMessage"; tempId: string; message: string; createdAt: string }
  | { kind: "requestCallback"; tempId: string; payload: { phone: string; preferredTime?: string; note?: string }; createdAt: string }
  | { kind: "requestService"; serviceId: string; createdAt: string };

const ACTION_QUEUE_PREFIX = "kagie_mobile_action_queue_v1";

function actionQueueKey(userId: string) {
  return `${ACTION_QUEUE_PREFIX}_${userId}`;
}

export async function getPendingMobileActions(userId: string) {
  return (await getDeviceJson<PendingMobileAction[]>(actionQueueKey(userId))) || [];
}

export async function clearPendingMobileActions(userId: string) {
  await deleteDeviceValue(actionQueueKey(userId));
}

export async function queuePendingMobileAction(userId: string, item: PendingMobileAction) {
  const current = await getPendingMobileActions(userId);
  const next = compactPendingMobileActions([...current, item]);
  await setDeviceJson(actionQueueKey(userId), next);
  return next;
}

function compactPendingMobileActions(queue: PendingMobileAction[]) {
  const latestNotificationRead = new Map<string, PendingMobileAction>();
  const ordered: PendingMobileAction[] = [];

  queue.forEach((item) => {
    if (item.kind === "markNotificationRead") {
      latestNotificationRead.set(item.notificationId, item);
      return;
    }
    ordered.push(item);
  });

  return [...latestNotificationRead.values(), ...ordered];
}
