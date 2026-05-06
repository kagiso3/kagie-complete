export function formatMoney(value: number | string | null | undefined) {
  return `R${Number(value || 0).toLocaleString("en-ZA")}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function firstName(fullName?: string | null) {
  return String(fullName || "Student").trim().split(/\s+/)[0] || "Student";
}

export function slugToTitle(route: string) {
  return route
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
