---
name: Organic Vitality
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#41493e'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#71796d'
  outline-variant: '#c1c9bb'
  surface-tint: '#326a2d'
  primary: '#003b05'
  on-primary: '#ffffff'
  primary-container: '#1a5319'
  on-primary-container: '#89c67e'
  inverse-primary: '#98d68c'
  secondary: '#4e6452'
  on-secondary: '#ffffff'
  secondary-container: '#d0e9d2'
  on-secondary-container: '#546a58'
  tertiary: '#591f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#7e2f00'
  on-tertiary-container: '#ff9f72'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b3f3a6'
  primary-fixed-dim: '#98d68c'
  on-primary-fixed: '#002202'
  on-primary-fixed-variant: '#185218'
  secondary-fixed: '#d0e9d2'
  secondary-fixed-dim: '#b4cdb7'
  on-secondary-fixed: '#0b2012'
  on-secondary-fixed-variant: '#364c3b'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7c2e00'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e5e2e1'
typography:
  display-xl:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-xl-mobile:
    fontFamily: Epilogue
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Epilogue
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Epilogue
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding-desktop: 64px
  container-padding-mobile: 20px
  gutter: 24px
  section-gap: 80px
  element-gap: 16px
---

## Brand & Style
The design system moves away from clinical utility toward a "Playful Premium" aesthetic. It targets a modern, health-conscious audience that views grocery shopping as an act of self-care rather than a chore. The personality is vibrant, rhythmic, and high-end.

The style is a fusion of **Modern Minimalist** structure and **Glassmorphism** depth, overlaid on a dynamic foundation. Instead of flat white surfaces, the system utilizes "Living Backgrounds"—soft, organic blobs and subtle gradients that shift slightly, suggesting freshness and growth. The interface feels "crafted" through the use of intentional whitespace, refined typography, and tactile depth.

## Colors
The palette is rooted in a deep, "Forest Green" primary for authority and freshness, paired with a soft "Sprout Green" secondary for surfaces. A vibrant "Sun-Kissed Orange" serves as the tertiary accent, used sparingly for high-energy interactions and urgency (e.g., flash sales or seasonal picks).

The background is never pure white. It uses a sophisticated off-white gradient with low-opacity organic shapes in the primary and secondary colors floating in the periphery to create a sense of life and "air."

## Typography
Typography is the primary vehicle for the "crafted" feel. **Epilogue** provides a geometric, editorial character for headlines, using tight letter-spacing to feel modern and intentional. **Be Vietnam Pro** handles body and labels, offering a warm, friendly, and highly legible experience. 

Hierarchy is established through significant scale shifts. Display styles should use a slight negative letter-spacing to emphasize the premium, high-density look of a boutique magazine.

## Layout & Spacing
The layout follows a fluid 12-column grid on desktop but prioritizes generous "breathable" margins to avoid a cluttered supermarket feel. 

Spacing is rhythmic, based on an 8px scale. To achieve the "crafted" look, use asymmetrical whitespace; for example, staggering product cards or allowing image assets to bleed slightly off-grid. Vertical rhythm is expansive—sections are separated by large gaps (`80px+`) to let the background organic shapes peak through.

## Elevation & Depth
Depth is achieved through **Tonal Layering** and **Soft Ambient Shadows**. 

1.  **Level 0 (Background):** Dynamic gradients with organic blurs.
2.  **Level 1 (Surface):** Pure white cards with a very soft, multi-layered "natural sunlight" shadow (low opacity, large spread).
3.  **Level 2 (Interaction):** Glassmorphic overlays (Background blur: 12px, Opacity: 80%) for navigation bars and floating action buttons, creating a sense of light passing through fresh produce.
4.  **Outlines:** Avoid heavy borders. Use 1px soft-green strokes (#D6EFD8) only for secondary input fields.

## Shapes
The shape language is "Organic-Geometric." All containers use a `16px` (rounded-lg) corner radius to feel approachable. Large-scale imagery and featured banners should use a `24px` (rounded-xl) radius or custom organic paths that mimic the shape of a leaf or a pebble to reinforce the natural theme.

## Components
-   **Buttons:** Primary buttons are Forest Green with slightly rounded corners and a subtle 3D lift on hover. Label text is always semibold.
-   **Cards:** Product cards use a white background, generous internal padding (24px), and a "floating" product image that breaks the top boundary of the card for a more dynamic, less "boxed-in" feel.
-   **Chips:** Category chips use the secondary green background with a dark green text. When active, they switch to the tertiary orange to pop.
-   **Input Fields:** Use a subtle "inset" shadow to feel tactile, like pressing into soft earth.
-   **Quantity Selectors:** Instead of standard boxes, use a pill-shaped "stepper" with large touch targets and haptic-friendly transitions.
-   **Special Mention:** Include "Freshness Badges"—small, glassmorphic icons that float over product images (e.g., "Picked Today").