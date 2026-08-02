# Platform Field Inventory

This document is the current-state rebuild specification for the coaching web platform. It is based on the React staff web application and FastAPI request/response models as of July 2026.

Use this as the data and screen checklist for a redesign. It describes what exists today, not a recommendation that every field must remain visible in the rebuilt UI.

## Conventions

- **Required** means required by the current UI or API create contract.
- **Optional** means the field can be empty or omitted.
- **Generated** means the backend creates or derives it; it is not a normal staff entry field.
- Dates are currently stored as ISO date strings (`YYYY-MM-DD`) unless noted otherwise.
- Most staff actions require an authenticated staff JWT. Finance is restricted to `super_admin` and `admin`.
- Client records, diet plans, follow-ups, transactions, uploaded files, meal uploads, chat messages, and audit logs are related by IDs rather than nested permanently in one record.

## Roles And Access

| Role | Current capabilities |
| --- | --- |
| `super_admin` | Full staff access; creates and manages staff; assigns clients; manages finance; generates invites. Legacy `coach` is normalized to this role. |
| `admin` | Staff operational access, including finance. |
| `dietitian` | Client, diet, follow-up, meal review, and chat work; cannot access finance. |
| `client` | Mobile/client API access only; not a staff web-dashboard role. |

## Route And Screen Map

| Route | Screen | Primary entities |
| --- | --- | --- |
| `/login` | Staff authentication | User |
| `/` | Dashboard | Clients, transactions, follow-ups, diet plans |
| `/clients` | Client tracker/list and client creation/edit | Client, comments, AI queries |
| `/clients/:id` | Client detail | Client, weights, tracker, comments, files, diet plans, meal uploads, health AI |
| `/leads` | Lead pipeline | Lead |
| `/diet-plans` | Client diet plans and master templates | Diet plan, client, parsed PDF, AI analysis |
| `/chat` | Coach-client conversations | Conversation, chat message |
| `/meal-reviews` | Meal-photo review queue | Meal upload, feedback |
| `/follow-ups` | Follow-up scheduling and completion | Follow-up, client |
| `/finance` | Transactions and finance reporting | Transaction, client |
| `/pending-tasks` | Auto/manual work queue | Pending task, manual task |
| `/audit-logs` | Immutable activity history | Audit log |
| `/settings` | Invite code, staff directory, client assignment | Staff member, client |
| `/unauthorized` | Access-denied state | None |

## Shared Entity: Client

Client is the central record. It is selected by diet plans, follow-ups, manual tasks, transactions, chat, meal reviews, files, and weight tracking.

### Client Form Fields

| Field / API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `name` | Full Name | text | Yes in UI/API | Main client identity. |
| `age` | Age | integer | Marked required in current UI; optional in API | The client form validates presence. |
| `gender` | Gender | radio/select | Optional | Values: `male`, `female`, `other`. |
| `height_cm` | Height (cm) | decimal | Optional | Used by calorie and healthy-weight calculations. |
| `diet_preference` | Diet Preference | select | Optional | Current options: Vegetarian, Non Vegetarian, Eggetarian, Vegan, Jain. |
| `email` | Email | email | Optional | API validates email format when present. |
| `phone` | Phone | text | Optional | Also used for client contact. |
| `about_client` | About Client | long text | Optional | General personal/context notes. |
| `health_issues` | Health Issues | text | Optional | Free text, currently comma-separated by convention. |
| `allergies` | Allergies | comma-separated text -> string list | Optional | Must be a true multi-value/tag field in redesign. |
| `avoid_foods` | Avoid Foods | comma-separated text -> string list | Optional | Dietary avoidance list. |
| `preferred_foods` | Preferred Foods | comma-separated text -> string list | Optional | Dietary preference list. |
| `disliked_foods` | Disliked Foods | comma-separated text -> string list | Optional | Dietary dislike list. |
| `medical_food_restrictions` | Medical Food Restrictions | comma-separated text -> string list | Optional | Medical restriction list; high safety importance. |
| `diet_start_date` | Diet Start Date | date | Optional | Can derive end date from diet duration. |
| `diet_duration` | Diet Duration | select | Optional | Current options: 7 Days, 10 Days, 14 Days. |
| `diet_end_date` | Diet End Date | date | Optional | Auto-calculated from start date/duration in current UI but can be manually set. |
| `program_start_date` | Program Start Date | date | Optional | Coaching program start. |
| `program_duration` | Program Duration | select | Optional | Current options: 1 Month, 2 Months, 3 Months, 4 Months. |
| `pause_days` | Pause Days | integer | Optional | Adjusts program end-date calculation. |
| `program_end_date` | Program End Date | date | Optional | Auto-calculated in current UI but editable. |
| `initial_weight_kg` | Start Weight (kg) | decimal | Marked required in current UI; optional in API | Weight baseline. |
| `current_weight_kg` | Current Weight (kg) | decimal | Optional | Usually updated by weight-log workflow rather than initial create form. |
| `goal_weight_kg` | Target Weight (kg) | decimal | Marked required in current UI; optional in API | Used for deficit/protein calculations. |
| `status` | Status | select | Optional | Current values: `active`, `on-hold`, `inactive`, `completed`. |
| `primary_coach` | Primary Coach | text | Optional | Current UI is free text. |
| `primary_coach_id` | Primary Coach ID | ID/reference | API-supported, not currently exposed as a distinct selector | Rebuild should use a staff selector and store this ID. |
| `location` | Location | text | Optional | City/location. |
| `profession` | Profession | text | Optional | Job/profession. |
| `recent_comment` | Recent Team Comment | text | Optional | Summary comment; distinct from chronological comment records. |
| `notes` | Notes | long text | Optional | General internal notes. |

### Client Fields Available In API But Not In Current Staff Create/Edit Form

| API key | Intended use |
| --- | --- |
| `last_follow_up_date` | Last completed follow-up date. |
| `upcoming_follow_up_date` | Next scheduled follow-up date. |
| `sleep_quality` | Client health/lifestyle detail. |
| `sleep_hours` | Client health/lifestyle detail. |
| `morning_freshness` | Client health/lifestyle detail. |

These should be explicitly decided during the rebuild rather than accidentally dropped.

### Client Generated / Display Fields

| Field | Meaning |
| --- | --- |
| `id` | Client UUID. |
| `coach_id` | Current ownership/visibility key. |
| `adherence_rate` | Derived adherence percentage, when available. |
| `created_at`, `updated_at` | Timestamps. |
| healthy weight range | Derived from height. |
| maintenance calories | Derived from height or current weight. |
| target daily calories | Derived from maintenance calories and goal deficit. |
| estimated protein target | Derived from goal/current/initial weight. |

### Client List / Tracker Display

The client list supports search and sorting. The tracker can display configurable columns including client identity, coach, plan/program timing, current/target weight, adherence, follow-up timing, and diet-related tracking activity. It also includes row urgency styling for overdue/near-due work.

### Client Detail Screen

The detail screen brings together these data groups:

- Profile and health details: all client form fields plus generated nutrition metrics.
- Weight history: entry date, weight in kg, notes, and derived weight change.
- Monthly tracker: day number/date and activity booleans for morning drink, breakfast, lunch, dinner, night drink, and workout.
- Comments: comment body, author, timestamp.
- Diet plans: plan name, day count, calories, type, status, metadata, download/export actions.
- Meal photos: meal type, image/file, caption, upload date, coach feedback/review state.
- Files: filename, category, MIME type, size, created timestamp.
- AI health analysis: summary, clinical risks, nutrition gaps, diet-pattern observations, recommended adjustments, follow-up questions, confidence notes, source files, model, generation timestamp/author.

### Client Detail Action Forms

| Action | Fields |
| --- | --- |
| Add/update weight | `weight_kg`, `recorded_date`, `notes` (optional). |
| Bulk/import weight | File or pasted text; parsed entries contain `recorded_date`, `weight_kg`, `notes` (optional). |
| Update tracker activity | Client ID, month, day/date context, activity name, completed boolean. |
| Add comment | Comment text. |
| Upload file | File, optional client ID, category. |
| Generate health analysis | Client context and stored files; no manual input besides action trigger. |

## Dashboard

Dashboard is display-only. It currently shows:

- Total clients and active clients.
- Monthly revenue.
- New clients in current month.
- Pending follow-up count.
- Monthly new-client enrollment chart (day-wise).
- Recent/new client cards: name, created date, status.
- Upcoming follow-ups: client name, type, scheduled date, status.
- Diet plans expiring soon: client name, diet end date, days remaining.

No direct entry form exists on this screen. Rebuild should retain direct navigation to the related operating screens.

## Leads

### Lead Form Fields

| API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `name` | Name | text | Yes | Main lead identity. |
| `status` | Status | select / pipeline stage | Optional; default `new` | See lead stages below. |
| `phone` | Phone | text | Optional | Contact field. |
| `email` | Email | email | Optional | API validated. |
| `age` | Age | integer | Optional | UI validates numeric input. |
| `gender` | Gender | select | Optional | Male, Female, Other, Not set. |
| `location` | Location | text | Optional | City/location. |
| `source` | Lead Source | text | Optional | Example: Instagram, referral, website. |
| `last_contacted_date` | Last Contacted | date | Optional | Last touchpoint. |
| `next_follow_up_date` | Next Follow-up | date | Optional | Lead follow-up scheduling. |
| `assigned_to` | Assigned To | text | Optional | Current UI is free text; should become staff reference in rebuild. |
| `notes` | Notes | long text | Optional | Internal lead notes. |

### Lead Stages

`new`, `call-booked`, `consultation-done`, `follow-up`, `plan-next-month`, `converted`, `lost`.

Legacy data may contain `contacted` (map to `call-booked`) or `consultation-booked` (map to `consultation-done`).

### Lead Display And Actions

- Kanban board grouped by stage.
- Cards display name, phone/email, location, source, status, last/next contact dates, assigned owner, and notes when present.
- Search covers name, phone, email, source, and location.
- Month filter uses lead `created_at` month.
- Create, edit, delete, and drag/move between stages are supported.
- Conversion produces `converted_client_id` (generated reference to resulting client).
- Generated fields: `id`, `coach_id`, `converted_client_id`, `created_at`, `updated_at`.

## Diet Plans And Master Templates

Diet plans support two entity types:

- `client_plan`: linked to a specific client.
- `master_template`: reusable, normally no client link until used for a client.

### Diet Plan Setup Fields

| API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_id` | Client | client selector | Required for client plan | Not used for standalone master template. |
| `name` | Plan Name / Template Name | text | Yes | E.g. `Aditi 14 Day Diet Plan`. |
| `plan_type` | Internal type | enum | Generated by create mode | `client_plan` or `master_template`. |
| `source_template_id` | Using Template | reference | Optional | Tracks source reusable template. |
| `plan_days` | Duration | select | Yes | Current options: 7, 10, 14 days. |
| `daily_calories` | Daily Calories | integer | Optional | May be prefilled from client maintenance calories. |
| `export_layout` | Export Layout | select | Optional | Current API values: `table`, `document`. |
| `is_active` | Active | boolean | Default true | API-supported; currently not a prominent form control. |
| `description` | Description | long text | Optional | Plan overview. |
| `instructions` | Instructions | long text | Optional | Client-facing/general instructions. |
| `footer_note` | Footer Note | long text | Optional | Printed in exported PDF. |

### Diet Summary / Routine Fields

`summary_slots` is a key-value object. Current UI exposes:

| Key | UI label | Purpose |
| --- | --- | --- |
| `morning_drink` | Morning Drinks | Fixed morning routine displayed above day plan. |
| `night_drink` | Night Drinks | Fixed night routine displayed above day plan. |
| `morning_snack` | API-supported summary slot | Derived from mid-morning meals when not explicitly set. |
| `evening_snack` | API-supported summary slot | Derived from evening snack meals when not explicitly set. |
| `bedtime` | API-supported summary slot | Derived from bedtime meals when not explicitly set. |

### Day-wise Meal Editor Fields

`day_wise_plan` is an array of one object per day. Each object includes:

| Key | UI label | Visibility |
| --- | --- | --- |
| `day` | Day number | Required/generated sequence: 1 through plan duration. |
| `morning_drink` | Morning Drink | Parsed/API supported; normally summarized rather than table-visible. |
| `breakfast` | Breakfast | Current editable/visible column. |
| `mid_morning` | Mid-Morning | Current editable/visible column. |
| `lunch` | Lunch | Current editable/visible column. |
| `evening_snack` | Evening Snack | Current editable/visible column. |
| `dinner` | Dinner | Current editable/visible column. |
| `night_drink` | Night Drink | Parsed/API supported; normally summarized rather than table-visible. |
| `bedtime` | Bedtime | Current editable column but not in default visible set. |

Each editable meal cell supports a primary meal and an optional alternate meal separated by ` | OR | `. The rebuild should model alternatives structurally rather than requiring a text convention.

### Diet Plan Display And Actions

- Client plan and master-template tabs.
- Plan card: plan name, client/template context, day count, activity state, template provenance, created/updated metadata.
- Upload reference PDF: file plus selected duration; backend parses text-based PDFs into day-wise plan data. PDF parser accepts only PDFs with extractable text; OCR scans are not currently supported.
- Export PDF: client plan plus client header metrics, summary, day plan, instructions, footer.
- AI nutrition analysis: client ID, plan days, day plan, summary, optional source filename. Displays maintenance/target calories, average calories/protein, protein adequacy, day breakdown, opportunities, confidence notes.
- AI suggestions: preset action or free-text prompt; may return recommendations and day/slot proposed changes.
- Diet safety check: checks parsed meals against allergies, avoid foods, disliked foods, and medical food restrictions; returns conflict location, reason, and replacement.
- Generated fields: `id`, `coach_id`, `version`, `created_at`, `updated_at`.

## Follow-ups

### Follow-up Create Form

| API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_id` | Client | client selector | Yes | Links follow-up to client. |
| `scheduled_date` | Date | date | Yes | Scheduled contact date. |
| `scheduled_time` | Time | time | Optional | Time of contact. |
| `type` | Type | select | Optional | Default `check-in`; current options include check-in, call, consultation, diet review, payment follow-up, and other. |
| `notes` | Notes | long text | Optional | Planned/completed notes. |

### Follow-up Display / Edit

- Filters: client-name text search and date filter.
- Grouped display: upcoming, this week, last week, last 15 days, older.
- Card/list data: client name, date/time, type, status, notes, creator, completion state.
- Edit/update fields additionally support `status` and `completed_at`.
- Generated fields: `id`, `coach_id`, `created_by_name`, `created_at`.

## Finance / Transactions

### Transaction Form

| API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `type` | Type | select | Yes | `income` or `expense`. |
| `category` | Category | select | Yes | Income and expense categories differ. |
| `amount` | Amount (INR) | decimal | Yes | Positive numeric value; type determines sign in displays. |
| `transaction_date` | Date | date | Optional | Defaults to today on backend if omitted. |
| `client_name` | Client Name | text | Optional, income use | Free-text client name. |
| `client_id` | Link Existing Client | client selector | Optional, income use | Client reference; backend resolves name from client when set. |
| `program_duration` | Program Duration | text | Optional, income use | E.g. `3 months`. |
| `payment_method` | Payment Method | select | Optional | UPI, Cash, Bank Transfer, Card, Razorpay, Other. |
| `source` | Source / Vendor | text | Optional | Lead source for income; vendor/source for expenses. |
| `description` | Comments | long text | Optional | Internal payment/expense note. |
| `imported_from` | Internal import source | text | System/import workflow | Name of source CSV; not normal manual entry. |

### Transaction Categories

- Income: Program Fee, Consultation, Renewal, Follow-up, Package, Other.
- Expense: Equipment, Supplies, Marketing, Rent, Utilities, Other.

### Finance Display / Actions

- Month filter, including All Months.
- KPI display: income, expense, net collections, average ticket size, transaction count.
- Charts: last 6 months income/net; selected-month daily income.
- Table columns: Date, Client, Amount, Duration, Source, Payment, Comment.
- CSV import: one or more `.csv` files. Recognized columns include date, client name, amount, program duration, source, description.
- CSV export: all visible transactions exported from the backend; fields include date, type, category, amount, client, client ID, duration, source, payment method, comment, source file, created timestamp.
- API supports update and delete even where the current screen may not expose every action.
- Generated fields: `id`, `coach_id`, `created_at`.

## Meal Reviews

This is a review workflow rather than a create form for staff.

### Filters And Display

- Filter values: All Uploads, Pending Review, Reviewed.
- Each card displays image/photo placeholder, meal type, new/review state, client name, upload date, caption, and coach feedback.
- Meal types used in UI: breakfast, lunch, dinner, snack.

### Feedback Form

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `feedback` | long text | Yes | Coach feedback sent against a meal upload. |

### Meal Upload API Data

`id`, `client_id`, `meal_type`, `photo_path`, `caption`, `uploaded_at`, `coach_feedback`.

## Chat

### Conversation Display

- Conversation list fields: client name, client ID, latest message sender/content, unread count.
- Selected conversation header: client name, role label, link to client profile.
- Message bubble fields: content, sender type, send time, read state.

### Send Message Form

| API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `content` | Type a message | text | Yes | Current web UI sends text only. |
| `message_type` | Internal | enum | Default `text` | API also supports `image`. |

Message response fields: `id`, `conversation_id`, `sender_id`, `sender_type` (`coach` or `client`), `content`, `message_type`, `read`, `created_at`.

## Pending Tasks

Pending tasks combine automatic work signals and manually created tasks.

### Task Display Fields

| Field | Meaning |
| --- | --- |
| `task_type` | Diet expiry, follow-up, program expiry, or manual task. |
| `title` | Human-readable action title. |
| `client_id`, `client_name` | Client link and name. |
| `comment` | Optional task note. |
| `due_date` | Date due. |
| `days_left` | Derived date difference. |
| `status` | Task/follow-up status when applicable. |
| `follow_up_id` | Link to source follow-up when applicable. |
| `created_by_name` | Manual-task creator when available. |

### Create Manual Task Form

| API key | UI label | Type | Required |
| --- | --- | --- | --- |
| `client_id` | Client | client selector | Yes |
| `comment` | Task / comment | long text | Yes |
| `due_date` | Due Date | date | Yes |

## Audit Logs

Audit logs are display-only in staff UI.

### Filter

- Event type filter: All Activity plus supported event categories.

### Audit Log Display Fields

`actor_name`, `actor_email`, `event_type`, `event_label`, `entity_type`, `entity_id`, `client_id`, `client_name`, `summary`, `old_value`, `new_value`, `metadata`, `created_at`.

Generated identifiers: `id`, `coach_id`, `actor_id`.

## Settings And Staff Administration

Settings contains two levels of functionality: all staff can retrieve/copy the coach invite code, while only super admins manage staff and assignments.

### Invite Code

| Field | Type | Notes |
| --- | --- | --- |
| `invite_code` | Generated string | Displayed, copied, and regenerated. Used for client mobile registration. |

### Add Staff Form

| API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `name` | Name | text | Yes | Staff name. |
| `email` | Email | email | Yes | Unique staff email. |
| `phone` | Phone | text | Optional | Staff phone. |
| `role` | Role | select | Optional | Current choices: `admin`, `dietitian`; default dietitian. |

### Staff Update / Display

- Update fields: `name`, `phone`, `role`, `status`.
- Staff record display: name, email, phone, role, status, linked user ID, assigned client count, created/updated dates.
- Staff status values: `active`, `inactive`.
- Generated fields: `id`, `user_id`, `assigned_client_ids`, `assigned_client_count`, `created_at`, `updated_at`.

### Client Assignment Form

| API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_ids` | Assigned Clients | multi-select checkbox list | Optional | Replaces the staff member's assigned-client list. Client search is available in UI. |

## Authentication Screens

### Staff Login

| API key | UI label | Type | Required |
| --- | --- | --- | --- |
| `email` | Email | email | Yes |
| `password` | Password | password | Yes |

### Staff Registration

| API key | UI label | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `name` | Full Name | text | Yes | Staff member name. |
| `email` | Email | email | Yes | Must be pre-approved in staff directory except initial owner bootstrap. |
| `password` | Password | password | Yes | Stored hashed. |
| `role` | Internal requested role | string | Defaults coach | Backend determines actual assigned role from staff directory. |

Authentication response data: `access_token`, `token_type`, and user object (`id`, `email`, `name`, `role`, `created_at`).

## Client Mobile / Client-Facing API Surface

There is no separate client web frontend in this repository, but these are active platform contracts that the rebuild must preserve if it includes client-facing screens.

### Client Registration

| API key | Required | Notes |
| --- | --- | --- |
| `name` | Yes | Client name. |
| `email` | Yes | Unique email. |
| `password` | Yes | Client password. |
| `phone` | No | Contact number. |
| `invite_code` | Yes | Coach/dietitian invite code. |

### Daily Check-in

| API key | Required | Notes |
| --- | --- | --- |
| `date` | No | Defaults to current date. |
| `meals` | No | Array of meal check-ins. |
| `meals[].meal_name` | Yes per item | E.g. breakfast, lunch, dinner, snack. |
| `meals[].completed` | Yes per item | Boolean. |
| `meals[].photo_id` | No | Link to uploaded meal photo. |
| `meals[].notes` | No | Meal note. |
| `water_glasses` | No | Integer; defaults 0. |
| `mood` | No | Current intended values: great, good, okay, bad. |
| `notes` | No | Daily note. |

Daily check-in response adds: `id`, `client_id`, `adherence_score`, `created_at`, `updated_at`.

### Client Mobile Displays / Actions

- Profile (`/client/me`): client record fields.
- Current diet plan (`/client/diet-plan`): diet-plan fields plus day-wise meals.
- Check-in history and today's check-in.
- Weight log: `weight_kg`, `recorded_date`, `notes`.
- Meal photo upload: file, meal type, caption.
- Meal upload history: meal upload fields and coach feedback.
- Chat messages: same message contract as staff chat.
- Follow-ups: follow-up fields relevant to current client.
- Client dashboard: aggregated client, adherence, plan, upcoming follow-up, and progress data.

## Files And Uploaded Documents

### Upload Form

| API key | UI / API label | Type | Required |
| --- | --- | --- | --- |
| `file` | File | binary | Yes |
| `client_id` | Client | ID/reference | Optional |
| `category` | Category | text | Optional; default `general` |

### File Display Fields

`id`, `client_id`, `category`, `original_filename`, `content_type`, `size`, `created_at`.

## API-Owned IDs And Timestamps To Preserve

The redesign should treat these as display/reference fields, not normal form inputs:

- IDs: user, staff, client, lead, diet plan, file, weight entry, comment, follow-up, transaction, task, audit log, meal upload, conversation, message, AI analysis/query/suggestion/conflict IDs.
- Ownership: `coach_id`, `actor_id`, `created_by_id`, `user_id`.
- Timestamps: `created_at`, `updated_at`, `uploaded_at`, `generated_at`, `completed_at`.
- Relationship IDs: `client_id`, `source_template_id`, `follow_up_id`, `converted_client_id`, `conversation_id`, `photo_id`.

## Rebuild Decisions Required

These are existing behaviors or data fields that should be consciously retained, changed, or retired:

1. Make array-like food fields tag inputs instead of comma-separated strings.
2. Replace free-text `primary_coach` and lead `assigned_to` with staff references while retaining display names.
3. Decide whether sleep quality, sleep hours, and morning freshness should return to the staff client form.
4. Preserve diet-plan `summary_slots` and all eight day-wise meal slots even if the new UI only displays a subset by default.
5. Keep both client-specific plans and reusable master templates, plus template provenance (`source_template_id`).
6. Keep generated audit data and relationship IDs in the data model even when hidden from normal staff forms.
7. Keep client mobile contracts aligned with the staff web rebuild, particularly diet plans, check-ins, meal uploads, chat, follow-ups, and weight logs.
8. Preserve finance imports and exports, including import source tracking and transaction categories.
