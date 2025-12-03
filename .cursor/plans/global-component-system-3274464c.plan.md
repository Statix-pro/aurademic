<!-- 3274464c-32f7-4190-9ef5-2b66f24fb02a a36b9f9b-8b8f-444b-bb95-984947fd3648 -->
# Global Component System Implementation

## Overview

Create a centralized design system with CSS variables for colors and reusable React components that follow the existing blue theme (#0069ab) used throughout the application.

## Implementation Steps

### 1. Create Global CSS Variables File

- **File**: `client/src/styles/variables.css`
- Define CSS custom properties for:
- Primary colors (blue theme: #0069ab, #005492, etc.)
- Secondary colors (blue-gray: #5d6b8a, #4a5575)
- Background colors (#f0f6ff, #e1f0ff, #fff)
- Border colors (#b3d9ff, #e0e0e0)
- Text colors (#4f4f6e, #495057)
- Spacing, border-radius, shadows, transitions
- Status colors (success, error, warning, info)

### 2. Create Global Components CSS File

- **File**: `client/src/styles/components.css`
- Base styles for reusable component classes:
- `.custom-box` - Container with consistent padding, border-radius, shadow
- `.custom-dropdown` - Styled select/dropdown with theme colors
- `.custom-button` - Button variants (primary, secondary, outline)
- `.custom-input` - Input fields with focus states
- `.custom-card` - Card component styles
- `.custom-alert` - Alert/notification styles

### 3. Create React Components Directory

- **Directory**: `client/src/components/common/`
- Create reusable React components:
- `CustomBox.jsx` - Wrapper component for consistent box styling
- `CustomDropdown.jsx` - Dropdown/select component
- `CustomButton.jsx` - Button component with variants
- `CustomInput.jsx` - Input field component
- `CustomCard.jsx` - Card component
- `CustomAlert.jsx` - Alert/notification component
- `index.js` - Export all components for easy importing

### 4. Component Features

Each component will:

- Accept standard props (className, children, onClick, etc.)
- Use CSS variables for theming
- Support variants (primary, secondary, outline, etc.)
- Include hover, focus, and disabled states
- Be compatible with Bootstrap where needed

### 5. Update Global Imports

- **File**: `client/src/index.js`
- Import `variables.css` and `components.css` globally
- This ensures CSS variables and base styles are available app-wide

### 6. Extract Color Scheme

Based on existing code, the color palette includes:

- Primary: #0069ab (main blue)
- Primary Dark: #005492 (hover state)
- Secondary: #5d6b8a (blue-gray)
- Background Light: #f0f6ff, #e1f0ff
- Border Light: #b3d9ff
- Text: #4f4f6e, #495057

## Files to Create

1. `client/src/styles/variables.css` - CSS custom properties
2. `client/src/styles/components.css` - Base component styles
3. `client/src/components/common/CustomBox.jsx` - Box component
4. `client/src/components/common/CustomDropdown.jsx` - Dropdown component
5. `client/src/components/common/CustomButton.jsx` - Button component
6. `client/src/components/common/CustomInput.jsx` - Input component
7. `client/src/components/common/CustomCard.jsx` - Card component
8. `client/src/components/common/CustomAlert.jsx` - Alert component
9. `client/src/components/common/index.js` - Component exports

## Files to Modify

1. `client/src/index.js` - Add global CSS imports

## Benefits

- Consistent styling across the application
- Easy theme updates via CSS variables
- Reusable components reduce code duplication
- Type-safe props with PropTypes
- Maintainable and scalable design system

### To-dos

- [ ] Create CSS variables file with color palette and design tokens
- [ ] Create global components CSS file with base styles for all components
- [ ] Create CustomBox React component with variants and props
- [ ] Create CustomDropdown React component with styling and props
- [ ] Create CustomButton React component with primary/secondary/outline variants
- [ ] Create CustomInput React component with focus states and validation
- [ ] Create CustomCard React component with header/body/footer support
- [ ] Create CustomAlert React component with success/error/warning/info variants
- [ ] Create index.js to export all common components
- [ ] Update index.js to import global CSS variables and components CSS