# LibraryPlan Application README

## 1\. Overview

**LibraryPlan** is a specialized frontend application built with **React**. It functions as a "Layout Planning Tool" designed to assist with spatial and inventory planning for libraries.

The application is structured as a single-page application (SPA) with three primary feature areas:

1.  **Shelf Calculator:** For calculating shelving requirements based on book inventory and holding formulas.
2.  **Layout Generator:** For generating optimal 2D library layouts based on floor plans, furniture, and user preferences.
3.  **Settings:** For managing furniture inventories, collections, and user account details.

## 2\. Core Features

  * **Shelf Calculator:**

      * Allows users to upload multiple spreadsheets (Meter Run, Target End State, Holdings).
      * Provides a form to input an "α value" for a holdings formula.
      * Simulates a "Calculate" process, after which it presents a "Results" screen with a "Download File" button.

  * **Layout Generator:**

      * Allows users to upload a floor plan.
      * Provides a form for specifying furnishing requirements (e.g., number of shelves, total floor area).
      * Features a preference grid where users can select priority zones (e.g., "Children's Section," "Toilets," "Reading Areas").
      * Simulates a "Generate" process, leading to a results page that displays:
          * Multiple suggested layouts (as `<LayoutSuggestionCard>` components).
          * A `<PerformanceMetrics>` chart (showing Space Efficiency, Accessibility, etc.).
          * A `<ZoneDistribution>` breakdown (showing area allocated to each zone).

  * **Settings:**

      * **Inventory Tab:** Allows users to manage "Inventory Collections."
          * View a list of existing collections.
          * Upload new inventory spreadsheets.
          * Select a collection to view/edit the `<FurnitureItem>` components within it.
      * **Account Tab:** A form for managing user credentials.
          * Includes fields for "Username" and "Password."
          * Features a `<PasswordStrength>` component to give real-time password feedback.
          * Includes a "Labelling" section for managing label templates.

## 3\. Frontend Architecture

### Tech Stack

  * **Framework:** **React** (v19.2.0)
  * **Bootstrapping:** **Create React App (CRA)** (using `react-scripts` v5.0.1)
  * **Icons:** **Lucide React** (v0.460.0) is used for all icons, abstracted via a central `<Icon>` component.
  * **Styling:** Standard CSS with component-specific `.css` files. A global `App.css` file defines root CSS variables for fonts and colors (e.g., `--red`, `--orange`, `--blue`).

### Folder Structure

The `src/` directory is organized by function:

  * `src/Pages/`: Contains the three main "smart" components that represent a full-page view:
      * `ShelfCalculatorPage/`
      * `LayoutGeneratorPage/`
      * `SettingsPage/`
  * `src/components/`: Contains all reusable "dumb" components, which are the building blocks of the UI. This folder is further organized by component type:
      * `Button/`
      * `Cards/`
      * `ChipProgress/`
      * `FormField/`
      * `Header/`
      * `Icon/`
      * `InventoryItem/`
      * `Loader/`
      * `NavBar/`
      * `PasswordStrength/`
      * `PerformanceMetrics/`
      * `ZoneDistribution/`
  * `src/App.js`: The root component that controls page navigation.
  * `src/index.js`: The application's entry point.

### Architectural Concepts

  * **State-Based "Routing":** The app does not use a formal routing library like `react-router`. Instead, `App.js` holds an `activePage` state. This state determines which `Page` component to render in the main content area.
  * **Lifting State Up:** Navigation is handled by `App.js` passing the `activePage` state and an `onNavClick` handler down to the `Navbar` component. When a nav item is clicked, `Navbar` calls `onNavClick`, which updates the state in `App.js`, triggering a re-render with the new page.
  * **Local Page State:** Each `Page` component is stateful and manages its own internal UI logic. For example, `ShelfCalculatorPage.js` manages its own `activeChip`, `isLoading`, and `resultsReady` state.
  * **Mocked Async Operations:** Long-running processes (like "Calculate" and "Generate") are currently simulated using `setTimeout` (e.g., for 3000ms). This mimics an API call and allows the UI to show a `<Loader>` component.

## 4\. How Components Work Together

The application follows a clear component hierarchy.

1.  **`App.js` (The Root Controller)**

      * Renders the persistent layout: `<Navbar>` (left sidebar) and `<Header>` (top bar).
      * Conditionally renders the active page (`<ShelfCalculatorPage>`, `<LayoutGeneratorPage>`, or `<SettingsPage>`) into the `<main>` content area based on its `activePage` state.

2.  **Navigation Components (`Navbar.js`, `Header.js`)**

      * `<Navbar>` receives `activePage` to highlight the current page and `onNavClick` to change it.
      * `<Header>` receives `activePage` to display the correct title and subtitle for the current view.

3.  **Page Components (e.g., `LayoutGeneratorPage.js`)**

      * These components act as the "brains" for each feature.
      * They use `<ChipProgress>` to manage their own internal tabs (e.g., "Input Files" vs. "Results").
      * They assemble the UI by composing multiple "building block" components. For instance, `LayoutGeneratorPage` combines:
          * `<UploadCard>` for the floor plan.
          * `<InputCard>` to wrap the settings forms.
          * `<SelectionCard>` to create the preference grid.
          * `<Loader>` during the (simulated) generation process.
          * `<LayoutSuggestionCard>`, `<ZoneDistribution>`, and `<PerformanceMetrics>` to display the final results.

4.  **"Building Block" Components (`src/components/`)**

      * **Card System:** The UI is heavily built on a system of "Card" components.

          * `InputCard.js`: A highly reusable wrapper for forms and lists. It provides a consistent header with an icon, title, and an optional `headerActions` slot for buttons (like "Edit" or "Download Template").
          * `UploadCard.js`: A specialized card that internally renders a dropzone, icon, and a `<Button>` to trigger a hidden file input.
          * `SelectionCard.js`: A simple card that manages its own "selected" state and reports clicks to its parent page.
          * `ResultsCard.js`: A simple card to show a "success" message and a download button.

      * **Icon Abstraction (`Icon.js`)**

          * This component acts as a central mapping layer for `lucide-react`.
          * Instead of importing icons directly in each component, components just pass a string `name` prop (e.g., `<Icon name="BookOpen" />`).
          * `Icon.js` contains a large `iconMap` object that resolves this string to the correct `lucide-react` component, providing a clean and maintainable way to manage icons.

      * **Atomic Components**

          * `Button.js`: A generic, styled button with `variant` and `size` props.
          * `FormField.js`: A wrapper for a styled `<input>` with an icon and label.
          * `PerformanceMetrics.js`: A self-contained component that maps over an array of `metrics` and renders a `MetricBar` for each one.
          * `ZoneDistribution.js`: A self-contained component that maps over `zones` data to render a grid of colored swatches and labels.

## 5\. Available Scripts

(This section is from the original `README.md` file)

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.  
Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) to view it in your browser.

The page will reload when you make changes.  
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.  
It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back\!**