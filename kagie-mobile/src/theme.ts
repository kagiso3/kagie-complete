export const colors = {
  bg: "#f4f7fb",
  bgCool: "#eef4ff",
  surface: "#ffffff",
  surfaceGlass: "rgba(255,255,255,0.88)",
  surfaceMuted: "#f8fbff",
  text: "#132238",
  textMuted: "#5f7086",
  brand: "#fd0505",
  brandDark: "#fd0505",
  brandSoft: "#ffe3e3",
  navy: "#111827",
  navySoft: "#e3f2fe",
  sky: "#2d9df9",
  skySoft: "#e8f4fe",
  gold: "#ffb500",
  goldSoft: "#fff2d4",
  orange: "#fd0505",
  orangeSoft: "#ffdddd",
  success: "#109669",
  successSoft: "#ddf7ea",
  danger: "#fd0505",
  dangerSoft: "#ffe3e3",
  border: "rgba(15,23,42,0.1)",
  borderSoft: "rgba(255,255,255,0.78)"
};

export const radii = { card: 16, control: 10 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32 } as const;

export const shadows = {
  card: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  lift: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2
  }
} as const;
