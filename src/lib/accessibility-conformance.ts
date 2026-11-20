/**
 * Accessibility Conformance Report data, in the format of the ITI VPAT 2.5
 * "INT" edition (WCAG 2.2 + US Section 508 + EU EN 301 549, which all map to
 * the same WCAG Level A/AA success criteria for web content).
 *
 * Internally assessed against this codebase, not audited by a third party. Keep
 * remarks factual: "Partially supports" means at least one part of the
 * platform does not yet meet the criterion, and the remark says where.
 * Update ACR_REVIEWED when re-assessing.
 */

export const ACR_REVIEWED = "2026-11-19";

export type ConformanceLevel = "Supports" | "Partially supports" | "Does not support" | "Not applicable";

export interface ConformanceRow {
  sc: string;
  name: string;
  level: "A" | "AA";
  conformance: ConformanceLevel;
  remarks: string;
}

export const WCAG22_CONFORMANCE: ConformanceRow[] = [
  { sc: "1.1.1", name: "Non-text Content", level: "A", conformance: "Partially supports", remarks: "Interface images and icons have text alternatives or are hidden from assistive technology. Figures inside articles depend on alt text supplied by authors; AI-suggested alt text is reviewed by an editor before publication, but older figures may lack it." },
  { sc: "1.2.1", name: "Audio-only and Video-only (Prerecorded)", level: "A", conformance: "Partially supports", remarks: "Podcast episodes and article narration offer transcripts where provided; not every legacy episode has one yet." },
  { sc: "1.2.2", name: "Captions (Prerecorded)", level: "A", conformance: "Partially supports", remarks: "Captions are available where the video host provides them; not all embedded media have been verified." },
  { sc: "1.2.3", name: "Audio Description or Media Alternative (Prerecorded)", level: "A", conformance: "Partially supports", remarks: "Text summaries accompany media items; full audio description is not produced." },
  { sc: "1.2.4", name: "Captions (Live)", level: "AA", conformance: "Not applicable", remarks: "No live audio or video is broadcast." },
  { sc: "1.2.5", name: "Audio Description (Prerecorded)", level: "AA", conformance: "Partially supports", remarks: "As 1.2.3." },
  { sc: "1.3.1", name: "Info and Relationships", level: "A", conformance: "Supports", remarks: "Landmarks, heading hierarchy, labelled form controls, list and table markup throughout the interface. Article PDFs are tagged with the same structure (headings, lists, tables with header cells, figures with alt text)." },
  { sc: "1.3.2", name: "Meaningful Sequence", level: "A", conformance: "Supports", remarks: "DOM order matches the visual reading order." },
  { sc: "1.3.3", name: "Sensory Characteristics", level: "A", conformance: "Supports", remarks: "Instructions do not rely on shape, position or colour alone." },
  { sc: "1.3.4", name: "Orientation", level: "AA", conformance: "Supports", remarks: "All views work in portrait and landscape." },
  { sc: "1.3.5", name: "Identify Input Purpose", level: "AA", conformance: "Supports", remarks: "Personal-data fields (name, email, password, one-time code) carry autocomplete tokens." },
  { sc: "1.4.1", name: "Use of Color", level: "A", conformance: "Supports", remarks: "Status and state are always given in text or an icon as well as colour." },
  { sc: "1.4.2", name: "Audio Control", level: "A", conformance: "Supports", remarks: "Interface sounds are short, never auto-play continuously, and can be switched off from the header." },
  { sc: "1.4.3", name: "Contrast (Minimum)", level: "AA", conformance: "Supports", remarks: "Text tokens measured at 5.4:1–18.4:1 in light and dark themes; checked automatically on every change." },
  { sc: "1.4.4", name: "Resize Text", level: "AA", conformance: "Supports", remarks: "Text scales to 200% without loss of content." },
  { sc: "1.4.5", name: "Images of Text", level: "AA", conformance: "Supports", remarks: "Text is real text except in logos." },
  { sc: "1.4.10", name: "Reflow", level: "AA", conformance: "Supports", remarks: "Layouts reflow to a 320 px width without horizontal scrolling; data tables scroll within their own region." },
  { sc: "1.4.11", name: "Non-text Contrast", level: "AA", conformance: "Supports", remarks: "Focus rings, input borders and chart marks meet 3:1." },
  { sc: "1.4.12", name: "Text Spacing", level: "AA", conformance: "Supports", remarks: "No fixed-height text containers clip when spacing is increased." },
  { sc: "1.4.13", name: "Content on Hover or Focus", level: "AA", conformance: "Supports", remarks: "Tooltips and menus are dismissible with Escape, hoverable and persistent." },
  { sc: "2.1.1", name: "Keyboard", level: "A", conformance: "Partially supports", remarks: "All navigation, forms and dialogs work by keyboard. Rotating the interactive 3D charts and drag-to-reorder lists in the dashboard need a pointer; keyboard alternatives are being added." },
  { sc: "2.1.2", name: "No Keyboard Trap", level: "A", conformance: "Supports", remarks: "Dialogs trap focus only while open and release it on close." },
  { sc: "2.1.4", name: "Character Key Shortcuts", level: "A", conformance: "Supports", remarks: "No single-character shortcuts are used." },
  { sc: "2.2.1", name: "Timing Adjustable", level: "A", conformance: "Supports", remarks: "Sessions last 7 days; no timed tasks." },
  { sc: "2.2.2", name: "Pause, Stop, Hide", level: "A", conformance: "Supports", remarks: "Decorative motion is short or stops, and is reduced when the system 'reduce motion' setting is on." },
  { sc: "2.3.1", name: "Three Flashes or Below Threshold", level: "A", conformance: "Supports", remarks: "Nothing flashes." },
  { sc: "2.4.1", name: "Bypass Blocks", level: "A", conformance: "Supports", remarks: "Skip-to-content link and landmarks." },
  { sc: "2.4.2", name: "Page Titled", level: "A", conformance: "Supports", remarks: "Every view sets a descriptive title." },
  { sc: "2.4.3", name: "Focus Order", level: "A", conformance: "Supports", remarks: "Focus follows reading order; focus returns to the trigger when a dialog closes." },
  { sc: "2.4.4", name: "Link Purpose (In Context)", level: "A", conformance: "Supports", remarks: "Link text or its context describes the destination." },
  { sc: "2.4.5", name: "Multiple Ways", level: "AA", conformance: "Supports", remarks: "Navigation menu, site search, author and collection directories, and a sitemap." },
  { sc: "2.4.6", name: "Headings and Labels", level: "AA", conformance: "Supports", remarks: "Headings and labels describe their topic or purpose." },
  { sc: "2.4.7", name: "Focus Visible", level: "AA", conformance: "Supports", remarks: "A visible focus ring on every interactive element." },
  { sc: "2.4.11", name: "Focus Not Obscured (Minimum)", level: "AA", conformance: "Supports", remarks: "Scroll padding keeps focused elements clear of the sticky header." },
  { sc: "2.5.1", name: "Pointer Gestures", level: "A", conformance: "Supports", remarks: "No multipoint or path-based gesture is required to use the platform; dragging a 3D chart to rotate it is optional." },
  { sc: "2.5.2", name: "Pointer Cancellation", level: "A", conformance: "Supports", remarks: "Actions fire on pointer up." },
  { sc: "2.5.3", name: "Label in Name", level: "A", conformance: "Supports", remarks: "Accessible names contain the visible label." },
  { sc: "2.5.4", name: "Motion Actuation", level: "A", conformance: "Not applicable", remarks: "No device-motion input." },
  { sc: "2.5.7", name: "Dragging Movements", level: "AA", conformance: "Partially supports", remarks: "Some dashboard lists are reordered by dragging; a single-pointer alternative is being added." },
  { sc: "2.5.8", name: "Target Size (Minimum)", level: "AA", conformance: "Supports", remarks: "Targets are at least 24 × 24 CSS px or adequately spaced." },
  { sc: "3.1.1", name: "Language of Page", level: "A", conformance: "Supports", remarks: "The page language follows the interface language the reader selects." },
  { sc: "3.1.2", name: "Language of Parts", level: "AA", conformance: "Partially supports", remarks: "Interface text is marked; passages in another language inside article bodies are not yet marked." },
  { sc: "3.2.1", name: "On Focus", level: "A", conformance: "Supports", remarks: "Focus never triggers a change of context." },
  { sc: "3.2.2", name: "On Input", level: "A", conformance: "Supports", remarks: "Changing a setting never navigates away unexpectedly." },
  { sc: "3.2.3", name: "Consistent Navigation", level: "AA", conformance: "Supports", remarks: "Header and footer are identical on every view." },
  { sc: "3.2.4", name: "Consistent Identification", level: "AA", conformance: "Supports", remarks: "Shared components keep the same names and icons." },
  { sc: "3.2.6", name: "Consistent Help", level: "A", conformance: "Supports", remarks: "Contact details and the assistant are in the same place on every view." },
  { sc: "3.3.1", name: "Error Identification", level: "A", conformance: "Supports", remarks: "Errors are described in text next to the field and announced." },
  { sc: "3.3.2", name: "Labels or Instructions", level: "A", conformance: "Supports", remarks: "Every field has a visible label." },
  { sc: "3.3.3", name: "Error Suggestion", level: "AA", conformance: "Supports", remarks: "Messages say how to fix the problem." },
  { sc: "3.3.4", name: "Error Prevention (Legal, Financial, Data)", level: "AA", conformance: "Supports", remarks: "Payments and submissions are reviewed before confirming; deletions ask for confirmation." },
  { sc: "3.3.7", name: "Redundant Entry", level: "A", conformance: "Supports", remarks: "Known details (name, email, affiliation) are pre-filled." },
  { sc: "3.3.8", name: "Accessible Authentication (Minimum)", level: "AA", conformance: "Supports", remarks: "Password managers and paste work; passkeys and ORCID sign-in need no memorised secret." },
  { sc: "4.1.2", name: "Name, Role, Value", level: "A", conformance: "Supports", remarks: "Built on accessible primitives (Radix UI) exposing correct roles and states." },
  { sc: "4.1.3", name: "Status Messages", level: "AA", conformance: "Supports", remarks: "Notifications use a polite live region." },
];

export function conformanceSummary(rows: ConformanceRow[] = WCAG22_CONFORMANCE): Record<ConformanceLevel, number> {
  const out: Record<ConformanceLevel, number> = { Supports: 0, "Partially supports": 0, "Does not support": 0, "Not applicable": 0 };
  for (const r of rows) out[r.conformance] += 1;
  return out;
}
