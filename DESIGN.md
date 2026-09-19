---
name: JevArena
description: A focused judgment composer in the user-pinned Proofpress visual language.
colors:
  primary: "#0e6675"
  primary-hover: "#0a5360"
  paper: "#ffffff"
  surface: "#ffffff"
  warm-paper: "#f8f7f3"
  ink: "#181a20"
  secondary: "#555b66"
  muted: "#686f78"
  quiet-accent: "#eff7f7"
  line: "#d7dcd9"
  danger: "#963c34"
typography:
  display:
    fontFamily: "DM Sans Variable, DM Sans, ui-sans-serif, sans-serif"
    fontSize: "clamp(32px, 4vw, 46px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "DM Sans Variable, DM Sans, ui-sans-serif, sans-serif"
    fontSize: "25px"
    fontWeight: 550
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans Variable, DM Sans, ui-sans-serif, sans-serif"
    fontSize: "15px"
    lineHeight: 1.55
  label:
    fontFamily: "DM Sans Variable, DM Sans, ui-sans-serif, sans-serif"
    fontSize: "13px"
    fontWeight: 550
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Consolas, monospace"
rounded:
  tag: "4px"
  control: "6px"
  judge: "8px"
  panel: "8px"
spacing:
  compact: "8px"
  field-gap: "17px"
  panel-inset: "24px"
  composer-gap: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "5px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 13px"
---

# Design System: JevArena

Related: [TypeSafe reference and adaptation boundaries](docs/DESIGN_REFERENCES.md). References inform proposals; the tokens below describe the current shipped workbench.

## Overview

**Creative North Star: "The Experimental Workbench"**

The Operate surface retains one centered composer and progressive disclosure, following the user's Arena interaction reference. Its visual language now follows the user's explicit Proofpress reference: DM Sans, IBM Plex Mono, a white canvas, warm input surface, dark ink, and restrained teal. The initial task takes priority over configuration; equally weighted judgments appear after execution, not as empty panels on arrival.

The implementation uses CSS and Lucide line icons. There are no generated raster assets. The locally generated result image is an export of experiment data, not decorative artwork.

**Key Characteristics:**

- Clear task controls and equally weighted model judgments.
- White canvas, warm input surface, teal actions, and flat ruled sections.
- Honest empty states, visible errors, and no fabricated results.

## Colors

Teal identifies actions, focus, and navigational cues; the stronger teal is the primary hover state. White carries the page and toolbar, while warm paper distinguishes the writing area and task controls. Ink carries primary content, secondary carries supporting composer copy, muted carries metadata, and line separates tasks without heavy framing. The pale accent surface supports notices and expanded controls. Danger identifies actual errors.

**The Equal Judges Rule.** Neither hidden judge receives a privileged color or visual weight.

## Typography

Self-hosted DM Sans Variable carries interface and editorial headings; the layout imports its Fontsource package. IBM Plex Mono is locally bundled at weights 400 and 500 for option indices, judge identifiers, result values, and JSON. Display text uses semibold weight and bounded tracking. Body text is comfortable rather than dense; labels stay compact.

The composer display follows the frontmatter scale. General page h1 text uses clamp(34px, 4vw, 49px), line height 1.13, and tracking (-0.035em). The wordmark uses weights 600/500 and tracking (-0.03em). Long user-supplied text wraps rather than truncating essential judgments.

## Layout

The homepage uses an (860px) maximum workspace with a centered composer, a divided toolbar, and compact starter prompts. The header is capped at (1280px). Connection, cost review and custom task fields are progressively disclosed. There is no initial results sidebar. Documentation has a (900px) container and prose measures around (70ch).

At (850px), navigation wraps and legacy workbench grids stack. At (500px), result cards and form rows stack, composer inset becomes (18px), and the main action occupies its own toolbar row. Navigation retains every primary destination; each link has a (44px) minimum target and the current route is underlined. Completed runs focus and scroll to the result heading so mobile users do not miss the outcome below the form.

## Elevation & Depth

Panels use one-pixel borders and tonal surfaces, without floating shadows. The selected task tab uses an inset one-pixel line, recorded in the sidecar, to distinguish its active state. Do not add decorative glow or glass effects.

## Shapes

Controls and starter prompts have restrained corners; composer and judge surfaces are slightly softer. Tags use compact squared corners. The simple writing area shares the composer's top corners; its toolbar is divided by a thin rule. Active judges use X and Y labels, indicating withheld identity rather than simulated content. No judge placeholders occupy the initial homepage.

## Components

### Buttons and fields

Primary buttons use teal, secondary buttons use white with a line border, and ghost buttons use teal text. Composer toolbar ghost controls use secondary ink at rest and the pale accent when expanded. Buttons have explicit hover, disabled, and keyboard-focus states. Standard inputs share a white surface, border, radius, and teal caret. The simple composer uses an unframed textarea on warm paper. Focus uses a two-pixel teal outline with four-pixel offset. Hover background transitions take (160ms); reduced-motion preference removes them.

### Navigation and case lists

The wordmark anchors a compact horizontal navigation. Cases use editorial rows with visible template labels, titles, language, and links. Search and task filters precede the list. Avoid invented metrics or community counts.

The first experiment presents one question/context input, editable possible answers (Yes / No by default), and three complete examples. There is no task-type or simple/advanced mode switch. The answer-comparison example puts both candidate answers in the question and fills A / B / Equally good choices. Historical structured comparison records retain their original fields for reproduction. Starting first reveals the key field; an explicit start action follows the cost estimate. Optional model and budget controls stay collapsed. The participation sequence is task, anonymous judgment, then vote to reveal. Community summaries use a single editorial column; engagement metadata is collapsed. Study pages separate source reports, verified provenance, limitations, and proposed reproduction, with original-post and author links. They are not model-run result pages.

### Comparison results

Two cards retain equal presentation. Before voting they show only the normalized choice and X/Y identity. After voting they show model, actual version or unknown, latency, cost basis, and supported probabilities. Vendor confidence remains separately labeled. Incomplete comparisons use an explanatory notice and never select a winner.

### State and accessibility

The skip link appears on focus. A permanent polite live region announces completion. Reduced-motion preference suppresses animation and animated scrolling. Sharing uses an inline content preview and explicit checkbox; it does not interrupt the user with a modal.

The editor retains its draft in memory. Loading an example over a user-edited draft requires an inline replace/keep choice; switching between untouched examples is immediate. Field errors identify and focus the first invalid input. Keys and private drafts are never persisted by this flow, and refresh clears them.

Selecting a quick start fills the editable question and all possible answers,
then focuses the question. Clear offers an in-memory
Undo. The textarea grows within a bounded height. Ctrl/Cmd+Enter opens key setup,
never a paid call. Privacy guidance appears when there is task input, with native
expandable details for provider processing, session-only keys, and deliberate
sharing. Research submission remains separate and deployment-gated; provider
retention is not controlled by JevArena.

## Do's and Don'ts

- Do keep the task and decisions visually central.
- Do preserve equal visual weight between judges.
- Do label templates, unverified observations, unknown costs, and unavailable providers clearly.
- Do maintain keyboard focus and mobile completion announcements.
- Don't show model identity, speed, cost, or probability before the blind vote.
- Don't invent results or imply community votes establish correctness.
- Don't add decorative raster imagery to the working surface.
