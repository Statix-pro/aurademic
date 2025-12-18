# Intern Guidelines for Event Module Refactoring

This document outlines the tasks and standards required to refactor the `events` feature. The primary goal is to establish a uniform codebase by aligning the `events` module (Frontend and Backend) with the existing `journals` module, which serves as the "Gold Standard" for this project.

## 1. Project Goal: Uniformity

The `events` feature was developed with inconsistent patterns and libraries. It must be refactored to match the design, structure, and coding standards of the `journals` feature.

**Reference Implementation:**
- **Frontend:** `client/src/features/journals/JournalForm.tsx`
- **Backend:** `server/modules/journal/`

## 2. Frontend Refactoring (`client/src/features/events`)

### 2.1. Visual Style & Layout
- **Bootstrap:** The UI must use standard Bootstrap classes for layout (Grid system, Cards) and components (Buttons, Forms, Alerts), matching the style of `JournalForm.tsx`.
- **CSS:** Use the shared form styles (`client/src/shared/styles/forms.css`) wherever possible. Avoid creating fragmented CSS files for every small component unless necessary.
- **Goal:** The `PreEvent`, `Finance`, and `EventUpdates` tabs should visually resemble the `JournalForm` sections (e.g., Author card style, input field spacing, section headers).

### 2.2. Icons & Plugins
- **Allowed:** Use **FontAwesome** (`@fortawesome/react-fontawesome`) for all icons.
- **Forbidden:** Remove all usages of `lucide-react` and `react-icons`.
  - *Action:* Uninstall these packages after removing their imports from the code.
- **Dropdowns:** Do **not** use `react-select`.
  - The `JournalForm` uses standard HTML `<select>` elements and a custom `<ul>`-based implementation for searchable dropdowns (e.g., Author/Journal search).
  - *Action:* Replace `react-select` components with this custom implementation. You are encouraged to extract the `JournalForm` search dropdown logic into a reusable shared component to avoid code duplication.

### 2.3. File Structure & Components
- **Tabbed Interface:** Keep the existing tabbed structure of the `EventPage` (Pre Event, Finance, Updates, etc.). Do **not** merge everything into a single massive file. However, ensure the code *inside* these components follows the clean patterns found in `JournalForm`.
- **EventEntry.tsx:** The file `client/src/features/events/components/EventEntry.tsx` appears to be a discarded prototype.
  - *Action:* Verify if any logic is needed, then **delete** this file and its route in `App.tsx`.

### 2.4. cleanup
- **Duplicate Utilities:** There is a duplicate `authenticityUtility.ts` in `client/src/utility/`.
  - *Action:* Delete `client/src/utility/` and update all imports to use the canonical utility at `client/src/shared/utils/authenticityUtility.ts`.

## 3. Backend Refactoring (`server/modules/events`)

The backend structure for `events` is currently fragmented and nested, unlike the flat structure of `journals`.

### 3.1. Directory Structure
- **Current State:** `server/modules/events/` contains subfolders like `preevents/`, `finance/`, `documents/`.
- **Target State:** Refactor this into a **flat structure** directly under `server/modules/events/`, similar to `server/modules/journal/`.
  - `server/modules/events/eventController.js` (Consolidate logic here)
  - `server/modules/events/eventRoutes.js`
  - `server/modules/events/eventModel.js` (if using a model file)

### 3.2. Code Standards
- Ensure all routes use the same response format and error handling middleware as the `journal` routes.

## 4. Summary of Tasks for Interns

1.  **Audit:** Review `JournalForm.tsx` to understand the target design.
2.  **Clean:** Remove `lucide-react`, `react-icons`, and `EventEntry.tsx`.
3.  **Refactor Frontend:** Rewrite `PreEvent.tsx` and other tabs to use Bootstrap, FontAwesome, and custom dropdowns.
4.  **Refactor Backend:** Flatten the `server/modules/events` directory structure.
5.  **Verify:** Ensure `events` creation flow works identically to the original implementation but with the new uniform codebase.
