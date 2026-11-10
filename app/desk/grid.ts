"use client";
/**
 * AG Grid setup for the Case Desk. Source (verified in node_modules type defs, AG Grid 36.3.0):
 * ModuleRegistry.registerModules, AllCommunityModule, MasterDetailModule, RowGroupingModule,
 * RowGroupingPanelModule, SetFilterModule, LicenseManager.setLicenseKey, themeQuartz.withParams (CoreParams).
 */
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { LicenseManager, MasterDetailModule, RowGroupingModule, RowGroupingPanelModule, SetFilterModule } from "ag-grid-enterprise";

let registered = false;
export function registerGrid() {
  if (registered) return;
  ModuleRegistry.registerModules([AllCommunityModule, MasterDetailModule, RowGroupingModule, RowGroupingPanelModule, SetFilterModule]);
  const key = process.env.NEXT_PUBLIC_AG_GRID_LICENSE_KEY;
  if (key) LicenseManager.setLicenseKey(key);
  registered = true;
}

/** "Warm paper & ink" grid theme, built only from Verbo's design tokens so it follows light/dark mode. */
export const verboGridTheme = themeQuartz.withParams({
  accentColor: "var(--v-brand)",
  backgroundColor: "var(--v-card)",
  foregroundColor: "var(--v-ink)",
  borderColor: "var(--v-line)",
  chromeBackgroundColor: "var(--v-paper-2)",
  headerBackgroundColor: "var(--v-paper-2)",
  headerTextColor: "var(--v-ink-2)",
  headerFontWeight: 600,
  oddRowBackgroundColor: "var(--v-paper)",
  rowHoverColor: "var(--v-brand-soft)",
  selectedRowBackgroundColor: "var(--v-brand-soft)",
  fontFamily: "var(--font-figtree), system-ui, sans-serif",
  fontSize: 15,
  spacing: 7,
  wrapperBorderRadius: 14,
  borderRadius: 8,
});
