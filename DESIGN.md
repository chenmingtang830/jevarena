---
name: JevArena
description: A clear experimental workbench for comparing judgment models.
colors:
  primary: "#38664c"
  primary-hover: "#2b533c"
  paper: "#f6f5f0"
  surface: "#fffefa"
  ink: "#1e2822"
  muted: "#626b63"
  quiet-green: "#e8eee5"
  line: "#d8dcd3"
  danger: "#963c34"
typography:
  display:
    fontFamily: "Geist Variable, Arial, sans-serif"
    fontSize: "clamp(34px, 4vw, 49px)"
    fontWeight: 550
    lineHeight: 1.13
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist Variable, Arial, sans-serif"
    fontSize: "25px"
    fontWeight: 550
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist Variable, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.55
  label:
    fontFamily: "Geist Variable, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 550
rounded:
  tag: "4px"
  control: "7px"
  judge: "9px"
  panel: "12px"
spacing:
  compact: "8px"
  field-gap: "17px"
  panel-inset: "22px"
  workspace-gap: "28px"
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
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 13px"
---

# Design System: JevArena

## Overview

**Creative North Star: "The Experimental Workbench"**

The Operate surface starts with one centered input, following the user's Arena homepage reference. Warm paper, dark ink, and a restrained green accent create a calm working environment. The initial task takes priority over configuration; equally weighted judgments appear after execution, not as empty panels on arrival.

The implementation uses CSS and Lucide line icons. There are no generated raster assets. The locally generated result image is an export of experiment data, not decorative artwork.

**Key Characteristics:**

- Clear task controls and equally weighted model judgments.
- Flat bordered surfaces, generous separation, and compact labels.
- Honest empty states, visible errors, and no fabricated results.

## Colors

The primary green identifies actions, focus, and helpful navigational cues. Paper is the page canvas; surface is the slightly lighter working area. Ink carries primary content, muted carries supporting prose, and line separates tasks without heavy framing. Quiet green is reserved for explanatory notices. Danger identifies actual errors.

**The Equal Judges Rule.** Neither hidden judge receives a privileged color or visual weight.

## Typography

The self-hosted variable Geist family carries both interface and editorial headings. Display text uses moderate weight and tight, bounded tracking. Body text is comfortable rather than dense; labels stay compact. Monospace is restricted to judge identifiers, option indices, and technical measurements.

The wordmark uses mixed weights and tracking of (-0.04em). Do not tighten it beyond this. Long user-supplied text wraps rather than truncating essential judgments.

## Layout

The homepage uses a narrow centered composer with a compact toolbar and a few starter prompts. Connection, cost review and custom task fields are progressively disclosed. There is no initial results sidebar. Documentation has a (900px) container and prose measures around (70ch).

At (850px), the workbench becomes a single column. At (500px), result cards and form rows stack and horizontal padding tightens. Navigation wraps without removing any primary destination; each link has a 44px minimum target and the current route is marked. Completed runs focus and scroll to the result heading so mobile users do not miss the outcome below the form.

## Elevation & Depth

Panels use one-pixel borders instead of shadows. Tonal backgrounds distinguish notices and controls. The selected task tab alone has a restrained shadow `(0 1px 3px #18261c15)` to distinguish its active state. Do not add decorative glow or glass effects.

## Shapes

Controls have gently rounded corners; full panels are slightly softer. Tags use compact squared corners. Active judges use X and Y labels, indicating withheld identity rather than simulated content. No judge placeholders occupy the initial homepage.

## Components

### Buttons and fields

Primary buttons use green, secondary buttons use surface with a line border, and ghost buttons use green text. Buttons have explicit hover, disabled, and keyboard-focus states. Inputs share the surface, border, radius, and green caret. Focus uses a two-pixel green outline with four-pixel offset.

### Navigation and case lists

The wordmark anchors a compact horizontal navigation. Cases use editorial rows with visible template labels, titles, language, and links. Search and task filters precede the list. Avoid invented metrics or community counts.

The first experiment presents one input and compact examples. Simple mode uses explicit Yes / No / Unsure judgments; it does not promise free-form chat. Custom choices and two-answer comparisons remain available in the advanced editor. A settings/cost review step precedes execution. The participation sequence is task, anonymous judgment, then vote to reveal. Cases offer early jumps between original templates and community case studies. Community summaries use a single editorial column; engagement metadata is collapsed. Study pages separate source reports, verified provenance, limitations, and proposed reproduction, with original-post and author links. They are not model-run result pages.

### Comparison results

Two cards retain equal presentation. Before voting they show only the normalized choice and X/Y identity. After voting they show model, actual version or unknown, latency, cost basis, and supported probabilities. Vendor confidence remains separately labeled. Incomplete comparisons use an explanatory notice and never select a winner.

### State and accessibility

The skip link appears on focus. A permanent polite live region announces completion. Reduced-motion preference suppresses animation and animated scrolling. Sharing uses an inline content preview and explicit checkbox; it does not interrupt the user with a modal.

Each task mode retains its own in-memory draft. Loading an example over an existing draft requires an inline replace/keep choice. Field errors identify and focus the first invalid input. Keys and private drafts are never persisted by this flow, and refresh clears them.

## Do's and Don'ts

- Do keep the task and decisions visually central.
- Do preserve equal visual weight between judges.
- Do label templates, unverified observations, unknown costs, and unavailable providers clearly.
- Do maintain keyboard focus and mobile completion announcements.
- Don't show model identity, speed, cost, or probability before the blind vote.
- Don't invent results or imply community votes establish correctness.
- Don't add decorative raster imagery to the working surface.
