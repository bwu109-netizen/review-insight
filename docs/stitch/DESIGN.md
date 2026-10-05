---
name: Obsidian Precision
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c7c6c6'
  on-secondary: '#303031'
  secondary-container: '#464747'
  on-secondary-container: '#b5b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#003823'
  tertiary-container: '#9df5c5'
  on-tertiary-container: '#10734d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#9df5c5'
  tertiary-fixed-dim: '#81d8ab'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005235'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
  surface-card: '#111111'
  surface-interactive: '#1A1A1A'
  border-hairline: rgba(255, 255, 255, 0.08)
  border-focus: rgba(255, 255, 255, 0.24)
  text-tertiary: '#5C5C5C'
  data-negative: '#E5675A'
  data-warning: '#E0B04A'
typography:
  stat-xl:
    fontFamily: Geist
    fontSize: 64px
    fontWeight: '300'
    lineHeight: 72px
    letterSpacing: -0.03em
  stat-xl-mobile:
    fontFamily: Geist
    fontSize: 44px
    fontWeight: '300'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '300'
    lineHeight: 56px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '300'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  eyebrow-mono:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.14em
  label-pill:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  gutter-mobile: 1rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies a dark, cinematic, and hyper-refined aesthetic tailored for intelligent e-commerce sentiment and review analytics. The personality is disciplined, technical, and austere—designed for enterprise operators, data scientists, and commerce leaders who demand surgical clarity over noise.

The design movement merges **Technical Minimalism** with **Atmospheric Functionalism**:
- **Monochrome Dominance:** A near-black canvas punctuated by pure white structural elements and subtle, purpose-driven semantic indicators.
- **Precision Typography:** A rigorous pairing of ultra-light contemporary grotesque sans-serifs with high-density, monospaced metadata labeling.
- **Crafted Subtlety:** Flat surfaces articulated exclusively through 1px structural hairlines (`rgba(255,255,255,0.08)`), low-contrast grid guides, and zero ambient drop shadows.
- **Two-Tone Typography:** Editorial headlines structured with a striking tonal shift—the primary subject rendered in bright white (`#F5F5F5`), resolving into secondary context in muted slate (`#8A8A8A`).
- **No Decoration:** Eliminates emojis, generic iconography, drop shadows, and 3D embellishments in favor of data density and typographic tension.

## Colors

The palette operates on strict contrast ratios and light emission principles on an OLED deep-black foundation.

### Role Assignments
- **Canvas Base (`neutral_color_hex` - `#0A0A0A`):** The structural viewport foundation, engineered to minimize eye strain and maximize the dynamic range of white typographic elements.
- **Surface Elevation 1 (`surface-card` - `#111111`):** Applied to bounded analytical cards, tables, and compartmentalized panels.
- **Surface Elevation 2 (`surface-interactive` - `#1A1A1A`):** Reserved for interactive states, input field grounds, elevated dropdowns, and pill toggle substrates.
- **Primary Accent (`primary_color_hex` - `#F5F5F5`):** The focal anchor. Powers primary pill call-to-actions, primary typographic emphasis, and hero metric numbers.
- **Secondary Tone (`secondary_color_hex` - `#8A8A8A`):** The contextual partner for the two-tone heading system, body paragraphs, and secondary interface markers.
- **Data Signals:** Semantics are functional and unpolluted. Positive sentiment and metric growth resolve to `#5FB58A`, anomalies and churn indicators map to `#E5675A`, and review volume warnings bind to `#E0B04A`.

## Typography

The typographic hierarchy establishes clear contrast between high-register metric analysis and technical machine data.

### Structural Logic
- **Hero & Stat Typography (`stat-xl`):** Massive numeric representations are deliberately set at light weight (`fontWeight: 300`) with tighter letter spacing (`-0.03em`). This preserves sophistication and avoids unrefined bulkiness.
- **Two-Tone Title Execution:** For headlines, wrap the opening thought or key subject in `#F5F5F5`, immediately closing the sentence with an inline `<span>` cast in `#8A8A8A`.
- **Machine Eyebrows (`eyebrow-mono`):** Every module header or analytic section must be anchored by an uppercase monospaced tag (e.g., `01 · SENTIMENT CLUSTERING` or `SYS // 004`). All eyebrows must use `JetBrains Mono`, tracking expanded to `0.14em`, rendered in `#5C5C5C` or `#8A8A8A`.

## Layout & Spacing

The architecture operates on an 8-point base spatial grid anchored within an engineered container model.

### Layout System
- **Viewport Constraints:** Max-width bounds sit at `1280px` for desktop dashboards and marketing views, centered with fluid margin reserves (`margin: 2rem` on desktop, reducing to `1.25rem` on mobile).
- **Grid Architecture:** 12-column layout on desktop (`1024px+`), collapsing into 6 columns on tablet (`768px - 1023px`), and a single fluid column on mobile (`<768px`).
- **Hairline Boundary Separation:** Sections and structural metric cells must be separated with 1px hairlines using `border-hairline` (`rgba(255, 255, 255, 0.08)`). Grid intersection markers may optionally place a 4px crosshair or faint dot pattern (`rgba(255, 255, 255, 0.05)`) at module seams.

## Elevation & Depth

This design system avoids all diffuse, blurred, or skeuomorphic drop shadows. Depth is communicated strictly through tonal contrast, frosted layering, and surface containment.

### The Depth Model
1. **Level 0 (Canvas Base):** Solid `#0A0A0A`. Non-interactive background with an optional 32px-interval background dot grid rendered at 4% white opacity.
2. **Level 1 (Card & Module Layer):** Flat `#111111` bounded by a 1px border of `rgba(255, 255, 255, 0.08)`. No drop shadows.
3. **Level 2 (Interactive & Hovered Modules):** Flat `#1A1A1A` with border color stepping up to `rgba(255, 255, 255, 0.16)`.
4. **Level 3 (Floating Orchestration):** Floating navigation bars, active tooltips, and contextual drawers utilize `rgba(17, 17, 17, 0.75)` accompanied by a `backdrop-filter: blur(16px)` and a precise outer hairline border of `rgba(255, 255, 255, 0.12)`.

## Shapes

The design system maintains an intentional contrast between structural, technical modules and floating interactive controls.

- **Analytical Panels & Cards:** Configured with `roundedness: 1` (`0.25rem` / `4px` to `rounded-lg` at `8px`). This preserves a crisp, scientific, instrument-like enclosure for tables and data cards.
- **Navigation & Interactive Pills:** Global navigation bars, chip filters, status indicators, and call-to-action buttons intentionally break the rectilinear baseline by employing full circular radius (`9999px` / pill shape).

## Components

### Buttons
- **Primary Pill:** Background `#F5F5F5`, text `#0A0A0A`, font `label-pill`, border `none`, border-radius `9999px`. Padding: `8px 20px`. Hover: Background `#FFFFFF` with slight opacity transition (`opacity: 0.9`).
- **Secondary Pill:** Background `#111111`, text `#F5F5F5`, border `1px solid rgba(255, 255, 255, 0.08)`, border-radius `9999px`. Hover: Background `#1A1A1A`, border `rgba(255, 255, 255, 0.24)`.
- **Tertiary / Ghost:** Background `transparent`, text `#8A8A8A`. Hover: text `#F5F5F5`.

### Floating Navigation Bar
- Positioned fixed top or floating bottom, centered.
- Background: `rgba(17, 17, 17, 0.8)`, `backdrop-filter: blur(12px)`, border `1px solid rgba(255, 255, 255, 0.08)`, border-radius `9999px`.
- Padding: `6px 12px`. Internal links set in `label-pill` with color `#8A8A8A` transitioning to `#F5F5F5` on hover.

### Metadata Chips & Tags
- Height: `24px`. Border radius: `9999px`.
- Background: `#161616`. Border: `1px solid rgba(255, 255, 255, 0.08)`.
- Typography: `eyebrow-mono` (`JetBrains Mono`, 11px).
- Semantic Variant: Negative indicator tags use text `#E5675A`, border `rgba(229, 103, 90, 0.25)`, background `rgba(229, 103, 90, 0.05)`.

### Cards & Analytical Panels
- Background: `#111111`. Border: `1px solid rgba(255, 255, 255, 0.08)`. Border radius: `8px`.
- Card Header: Features an eyebrow marker (e.g., `02 · ASPECT SENTIMENT`) set to `#5C5C5C`, alongside a lightweight title (`Geist`, weight `400`).
- Card Body: Generous internal padding using `space-lg` (`24px`).

### Input Fields & Controls
- Background: `#111111`. Border: `1px solid rgba(255, 255, 255, 0.08)`. Border radius: `6px`.
- Text: `#F5F5F5`, placeholder text `#5C5C5C`, font `body-md`.
- Focus state: Border transitions to `rgba(255, 255, 255, 0.24)`. No outline rings or colored glows.

### Checkboxes & Radios
- Box size: `16px x 16px`. Radius: `3px` for checkbox, `9999px` for radio.
- Background: `#111111`. Border: `1px solid rgba(255, 255, 255, 0.24)`.
- Checked state: Background `#F5F5F5`, with an inner black tick/dot (`#0A0A0A`).
