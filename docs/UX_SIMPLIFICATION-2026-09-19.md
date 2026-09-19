# Input-first flow correction

User feedback identified a comprehension failure despite passing functional tests: the borderless filled composer looked read-only, and starter cases presented a guessing exercise instead of a clear way to test Jev.

The corrected path is: edit a task → connect an OpenRouter key → review models and cost → explicitly run → vote and reveal → optionally share or contribute.

- The composer always has a visible label and textarea border, including after a quick start. Quick starts only fill and focus the input; there is no separate “Edit text” mode or template card.
- The first action opens setup, never inference. Without a key it expands and focuses the key field. Model configuration appears after connection; paid execution still requires its own explicit button.
- Starter cases open the same editable workbench immediately. Reference answers are optional disclosures, not model results. Imported observations retain their unverified label and remain explicitly associated with the original task rather than subsequent edits.
- Primary navigation is Compare and Examples. Methodology and research results remain available in the footer. No scoring, consent, spending checks, or model-call boundaries were removed.
- Sharing a template is labelled “Share this example”; sharing imported observations is distinguished from sharing a newly run experiment.

The existing Proofpress-derived fonts and palette are preserved. This is an interaction correction, not evidence that usability has been validated with external users. Regression checks cover persistent input affordance, focus, editable quick starts, case import, keyboard use, privacy disclosure, and explicit paid-call boundaries on desktop and mobile.
