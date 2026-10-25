@AGENTS.md

# FitFlow Pro — Product, Engineering & Design System Specification

## 1. Role and Mission

You are the senior full-stack engineer, product designer, and technical architect responsible for building FitFlow Pro.

Build a production-minded SaaS platform for personal trainers and their students. The product must be secure, responsive, accessible, maintainable, and designed to support a subscription-based business in Brazil.

Do not merely generate attractive mockups. Build functional software with clear architecture, reliable data handling, meaningful validation, and consistent user experience.

Work incrementally. Inspect the existing repository before making changes. Preserve working functionality and never claim that a feature or test works unless it has been verified.

## 2. Product Vision

FitFlow Pro helps personal trainers manage their coaching business and helps students follow personalized fitness plans.

### Trainer capabilities
- Secure registration, login, logout, and password recovery.
- Trainer profile and workspace management.
- Student invitations, enrollment, and account association.
- Student profiles and relevant training information.
- Exercise library with instructions, muscle groups, equipment, and demonstration media.
- Workout plan creation, scheduling, sets, repetitions, load, rest periods, and exercise order.
- Student workout assignment and completion tracking.
- Hydration goals, reminders, and water intake logging.
- Nutrition plans with meals, foods, quantities, and units.
- Calorie and macronutrient estimates with transparent data sources.
- Progress tracking, measurements, historical records, and charts.
- Subscription management and billing status.
- Appropriate dashboards, reports, and notifications.

### Student capabilities
- Secure access to their assigned trainer and plans.
- View workout schedules and exercise demonstrations.
- Record completed exercises, sets, repetitions, and loads where applicable.
- Track daily hydration and progress toward their configured goal.
- View assigned meal plans and food quantities.
- Track body measurements and historical progress.
- Manage account preferences and view subscription information when relevant.

### Product principles
- Trainers can only access data they are authorized to manage.
- Students can only access their own data and information explicitly shared with them.
- Personalized plans must be assigned intentionally.
- Nutrition and hydration values are estimates or configured targets, not medical guarantees.
- The product must not fabricate health measurements, activity records, or completed actions.

## 3. Technology Stack

Use the following stack unless the existing repository or a documented technical constraint requires an adjustment.

- Next.js with App Router.
- React and TypeScript with strict type checking.
- Tailwind CSS.
- shadcn/ui for reusable accessible interface components.
- Lucide React for icons.
- Supabase PostgreSQL for application data.
- Supabase Auth for authentication.
- Supabase Row Level Security (RLS) for authorization at the database level.
- Supabase Storage for authorized media when appropriate.
- Zod for schema validation.
- React Hook Form for complex forms where appropriate.
- Recharts for data visualization when needed.
- Vitest or the repository's existing unit testing framework.
- Playwright for end-to-end tests when the project is ready.
- Vercel or another compatible deployment platform.
- A payment provider suitable for recurring subscriptions in Brazil, selected and integrated as a separate implementation phase.

Do not add redundant dependencies. Inspect package.json and existing project conventions before installing or replacing packages.

## 4. Official Brand Identity

### Positioning

FitFlow Pro is a premium fitness management platform built around performance, clarity, consistency, and measurable progress.

Brand personality:
- Confident.
- Modern.
- Energetic.
- Professional.
- Focused on action and progress.

The interface must feel like a polished SaaS product, not a generic fitness template or a gamified toy.

### Visual direction

Use a high-contrast performance aesthetic.

- Light theme is the default.
- Dark theme is optional and must be fully supported.
- Use lime green selectively for primary actions, progress indicators, and meaningful highlights.
- Use generous whitespace, clear typography, restrained borders, and subtle shadows.
- Avoid excessive gradients, heavy shadows, excessive animation, decorative glassmorphism, and visual clutter.
- Never use emojis as substitutes for functional interface icons.

### Official brand palette

| Token | Value | Purpose |
|---|---|---|
| Brand primary | #B7F34A | Primary highlights and performance indicators |
| Brand dark | #101411 | Brand identity and dark surfaces |
| Light background | #F5F7F4 | Default page background |
| Light surface | #FFFFFF | Cards, forms, and dialogs |
| Primary text | #182019 | Main text and headings |
| Secondary text | #566157 | Supporting text |
| Border | #DDE3DC | Borders and separators |
| Information | #2563EB | Links and informational states |
| Success | #218653 | Success states |
| Warning | #B45309 | Warning states |
| Error | #DC4545 | Error states |

Validate actual foreground/background combinations for contrast. Do not assume the brand colors are accessible in every combination.

### Semantic theme tokens

Centralize tokens in the project's existing styling system. If using shadcn/ui, follow its existing CSS variable and theme conventions.

Provide semantic tokens for:
- background and foreground
- card and card-foreground
- popover and popover-foreground
- primary and primary-foreground
- secondary and secondary-foreground
- muted and muted-foreground
- accent and accent-foreground
- destructive and destructive-foreground
- border, input, and ring
- success, warning, and info
- sidebar tokens when a sidebar exists

Light theme:
- Background: #F5F7F4.
- Surface: #FFFFFF.
- Primary text: #182019.
- Secondary text: #566157.
- Border: #DDE3DC.
- Default primary button: #101411 with a suitable high-contrast foreground, or lime green with dark text after contrast validation.

Dark theme:
- Background: #101411.
- Surface: #1B211C.
- Elevated surface: #242C25.
- Primary text: #F5F7F4.
- Secondary text: #C4CCC5.
- Border: #38423A.
- Primary highlight: #B7F34A, with dark foreground when contrast is sufficient.
- Links and informational colors must remain legible on dark surfaces.

Components must consume semantic tokens rather than scattered hardcoded color values.

### Theme behavior

- Default to the light theme.
- Respect the operating system preference on the initial visit when no explicit user preference exists.
- Provide an accessible manual theme toggle.
- Persist the user's preference using the project's existing solution.
- Avoid a flash of incorrect theme during initial rendering.
- Ensure every component, dialog, menu, form, chart, and navigation element supports both themes.
- Do not implement dark mode by merely inverting colors.

### Typography

Prefer Geist if it is already configured. Otherwise, use the existing font or Inter with a suitable system fallback.

Use a consistent type scale:
- Main headings: 30–36 px on desktop and 26–30 px on mobile.
- Section headings: 20–24 px.
- Card headings: 16–18 px.
- Body text: 14–16 px.
- Supporting text: generally 12–14 px.
- Metrics should use consistent sizing and alignment.

Use font weights 400, 500, 600, and 700 as appropriate. Avoid unnecessary type styles and excessive uppercase text.

### Logo and brand mark

Create a reusable geometric FitFlow Pro logo.

Concept:
- A simple geometric outline.
- An ascending stroke representing progress and improvement.
- Lime green as an optional symbol accent.
- A readable wordmark displaying “FitFlow Pro”.
- A compact symbol-only variant.
- Light and dark background variants.
- A favicon-compatible version.

Implement the logo as a local SVG or reusable React component. Do not rely on remote images or third-party logo assets.

The logo must remain recognizable at 24, 32, and 48 px. Use one consistent design across all pages.

## 5. Icon System

Use lucide-react for functional interface icons.

Recommended icon concepts:
- Navigation: LayoutDashboard, Users, Dumbbell, Droplets, Utensils, ChartNoAxesCombined, CalendarCheck, Bell, Settings.
- Workouts: PlayCircle, CircleCheck, Timer, Video.
- Nutrition: Apple, Utensils, Flame.
- Progress: TrendingUp, Scale, Trophy.
- Management: Search, Plus, Pencil, Trash2, ChevronRight, Ellipsis.
- Billing: CreditCard, Receipt, CircleAlert.
- Interface: Menu, X, Sun, Moon, Check, LoaderCircle, CircleHelp.

Verify actual exports against the installed Lucide version. If an icon name is unavailable, select a valid equivalent.

Rules:
- Navigation icons should normally be 20–22 px.
- Button icons should normally be 16–20 px.
- Maintain consistent stroke weight and visual style.
- Decorative icons must be hidden from assistive technology.
- Icon-only buttons require accessible names.
- Do not use an icon alone when a visible label is necessary for usability.

## 6. Component Design Standards

Create reusable components where appropriate:
- Button with primary, secondary, outline, ghost, and destructive variants.
- Input, Label, Select, Checkbox, and Textarea.
- Card, CardHeader, CardContent, and CardFooter.
- Badge and status indicators.
- Dialog and AlertDialog.
- DropdownMenu and Tabs.
- Responsive table patterns.
- Progress indicators and metric cards.
- Skeleton, EmptyState, ErrorState, and Toast.
- PageHeader and SectionHeader.
- Accessible form fields with validation messages.
- ThemeToggle.
- BrandLogo.

Design standards:
- Controls generally use 8–12 px corner radii.
- Cards generally use 12–16 px corner radii.
- Use subtle borders and restrained shadows.
- Base spacing on consistent multiples of 4 px.
- Primary buttons should generally be 44–48 px tall.
- Provide hover, active, focus-visible, disabled, and loading states.
- Keep transitions brief and purposeful.
- Maintain visual hierarchy and predictable interaction patterns.

Reuse existing shadcn/ui components where possible instead of creating unnecessary parallel implementations.

## 7. Responsive Design

Use a mobile-first approach and follow the breakpoints already established in the project.

Validate layouts at:
- 320–375 px: small mobile.
- 390–430 px: common mobile.
- 768 px: tablet.
- 1024 px: small desktop.
- 1280 px and above: desktop.

Requirements:
- No unintended horizontal overflow.
- Forms must remain usable on narrow screens.
- Tables must use an appropriate responsive layout or controlled horizontal scrolling.
- Navigation must work with keyboard and touch.
- Dialogs and menus must fit within the viewport.
- Charts must resize without clipping important labels.
- Support loading, empty, error, success, and disabled states.
- Keep desktop content at a comfortable readable width.

Trainer workspace:
- Sidebar navigation on desktop when appropriate.
- Compact mobile navigation.
- Clear student management and operational summaries.
- Search, filters, and tables that remain usable at different viewport sizes.

Student experience:
- Prioritize the current workout and the student's next action.
- Use bottom navigation on mobile when appropriate.
- Make workout controls easy to reach during exercise.
- Display hydration, nutrition, and progress information only when those features are implemented and relevant.

## 8. Accessibility

Target WCAG 2.2 Level AA.

- Minimum 4.5:1 contrast for normal text.
- Minimum 3:1 contrast for large text and applicable meaningful UI graphics.
- Visible keyboard focus indicators.
- Logical keyboard navigation and tab order.
- Proper labels for all form controls.
- Clear validation messages associated with their fields.
- Prefer touch targets of at least 44 × 44 px.
- Never communicate status through color alone.
- Respect prefers-reduced-motion.
- Use semantic HTML and accessible names.
- Test both light and dark themes.
- Do not remove outlines without providing a clear focus alternative.
- Use accessible dialog, menu, and form behavior from established components whenever possible.

## 9. Architecture and Code Quality

- Use TypeScript strict mode.
- Prefer small, cohesive components and clear separation of concerns.
- Keep server-only logic out of client components.
- Use Server Components by default and Client Components only when interactivity requires them.
- Validate external input using Zod or the existing validation layer.
- Handle errors explicitly.
- Avoid duplicated business logic.
- Keep secrets and privileged credentials on the server.
- Never expose Supabase service-role keys in NEXT_PUBLIC variables.
- Never trust client-supplied role information for authorization.
- Preserve the project's existing linting, formatting, and testing conventions.
- Do not rewrite working files merely to match personal preferences.

## 10. Supabase and Data Security

Use Supabase Auth, PostgreSQL, and RLS.

Requirements:
- Create versioned SQL migrations for schema changes.
- Enable and correctly configure RLS on tables containing private or tenant-specific data.
- Define explicit policies for trainers, students, workspace membership, and assigned plans.
- Validate authorization on the server and at the database level.
- Ensure a student cannot access another student's private records.
- Ensure trainers can only access workspaces and students they are authorized to manage.
- Keep credentials server-side.
- Never bypass RLS for convenience.
- Avoid storing unnecessary sensitive personal information.
- Use appropriate validation, indexes, foreign keys, and constraints.
- Test access boundaries with positive and negative cases.

Never invent a successful migration or claim that RLS is secure without reviewing the actual policies.

## 11. Nutrition, Hydration, and Fitness Data

- Store units explicitly and consistently.
- Use appropriate decimal precision for quantities and measurements.
- Identify whether a value is user-entered, calculated, or estimated.
- Do not present calorie expenditure estimates as exact measurements.
- Make nutrition estimates traceable to their data source where possible.
- Treat hydration goals as configurable targets, not medical prescriptions.
- Avoid making medical diagnoses or unsupported health claims.
- Track timestamps and historical records consistently.
- Never fabricate completed workouts, measurements, or student activity.

## 12. Subscription and Billing Architecture

The product will be sold in Brazil.

- Evaluate recurring payment support, webhook behavior, fees, and available payment methods before choosing a provider.
- Consider Mercado Pago or Asaas where suitable.
- Keep billing integration isolated behind server-side services.
- Verify webhook signatures and handle events idempotently.
- Maintain explicit subscription statuses.
- Never grant or revoke paid access solely based on an unverified client redirect.
- Keep payment credentials server-side.
- Do not store raw card details.
- Implement billing only in its designated phase.
- Do not simulate a successful payment in production code.

## 13. Development Workflow

Before every implementation task:
1. Inspect the relevant files and existing patterns.
2. Identify dependencies and constraints.
3. Plan the smallest safe implementation.
4. Preserve working features.
5. Implement incrementally.
6. Run relevant checks.
7. Report actual results and limitations.

Do not recreate the repository or replace configuration files without a clear technical reason.

If a requested feature depends on missing credentials, an external account, or a third-party decision, implement only the parts that can be safely completed and document the blocker.

## 14. Implementation Roadmap

### Phase 1 — Foundation and Authentication
- Repository and application setup.
- Supabase configuration.
- Sign-up, login, logout, and password recovery.
- User profiles and roles.
- Trainer workspace and membership model.
- Protected routes.
- RLS policies and migration files.
- Initial tests and environment documentation.

### Phase 2 — Student Management
- Student invitations and enrollment.
- Student profiles.
- Trainer-to-student relationships.
- Secure student lists and profile pages.

### Phase 3 — Exercise Library and Workouts
- Exercise catalog.
- Exercise instructions and demonstration media.
- Workout builder.
- Sets, repetitions, load, rest, and scheduling.
- Workout assignment and completion tracking.

### Phase 4 — Hydration
- Configurable daily goals.
- Water intake logging.
- Daily progress and history.
- Reminder preferences and appropriate notification infrastructure.

### Phase 5 — Nutrition and Calories
- Meal plans and meal schedules.
- Food quantities and units.
- Nutrition estimates and macronutrients.
- Calorie and activity estimates with clear limitations.

### Phase 6 — Progress Tracking
- Body measurements and progress history.
- Charts and reports.
- Personal records and relevant progress indicators.

### Phase 7 — Subscriptions and Production Readiness
- Payment provider integration.
- Subscription management.
- Verified webhooks and entitlement handling.
- End-to-end testing.
- Deployment configuration, monitoring, and operational documentation.

Do not implement every phase in one operation. Complete and verify each phase before moving to the next.

## 15. Definition of Done

A task is complete only when:
- The requested behavior is implemented.
- Existing functionality remains intact.
- Relevant validation and error states are handled.
- Security implications have been reviewed.
- The interface follows the official design system.
- Responsive behavior and accessibility have been checked where relevant.
- Applicable tests have been executed.
- Available lint, typecheck, and build scripts have been run when appropriate.
- No unverified test result is reported as successful.
- The final report lists changed files, commands executed, actual results, and known limitations.

## 16. Communication and Product Language

All source code, identifiers, comments, technical documentation, commit messages, and developer-facing instructions must be written in English.

All user-facing product copy must be written in Brazilian Portuguese (`pt-BR`), including labels, buttons, form validation, notifications, onboarding, and empty states.

Keep user-facing language clear, concise, and professional. Use Brazilian date, number, currency, and measurement conventions where applicable.

Do not translate existing technical identifiers unnecessarily.

## 17. Immediate Task Instructions

When asked to implement a feature:
- Read this file first.
- Inspect the actual repository.
- Work only on the requested phase.
- Follow the official FitFlow Pro design system.
- Reuse existing architecture and components.
- Do not fabricate application data or claim unperformed actions.
- Execute relevant checks and report their actual results.

If the user explicitly requests a repository audit or implementation plan instead of code changes, provide the audit or plan without prematurely modifying the project.
