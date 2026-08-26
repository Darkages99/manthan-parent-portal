# Feature testing tracker

Every feature in the app, grouped by when it was last touched (most recent
first). Everything is marked **untested** — including PTM and stay-back,
which had earlier passes but need a full retest after this round of changes.
Test in this order, top to bottom.

Legend: `[ ]` untested · `[x]` tested and working · `[!]` tested, found an issue

## Uncommitted — this session (UI + data pass)

- [ ] Reports/issues visibility (0039): parent picks Principal-only / Front-office+principal / directed to specific teacher(s); staff see only what their role/targeting allows. Verify as principal, front office, a targeted teacher, a non-targeted teacher.
- [ ] Data-integrity rules (0040): can't add a student with no parent; can't save a parent with neither email nor a child; can't remove a student's last parent. Sheets sync still succeeds (routes guardian upsert through `sync_upsert_guardian`).
- [ ] Sticky "+" create FAB on students, parents, staff, PTM, messages, competitions
- [ ] Attendance donut shows a "Not marked" slice; present % is roster-relative (30/60 = 50%, not 100%)
- [ ] Leave requests: awaiting ordered by leave date (tomorrow first); all 3 sections show top 2 + "See N more"
- [ ] Dashboard "today" sections (on leave / homework due / staying back), role-scoped; school calendar now on the console + `/console/calendar` route + nav item
- [ ] Stay-back: two dropdowns by the search bar (time range default This year, status default Pending); approval-chain node diagram no longer horizontally scrolls
- [ ] Timetable: Period structure + Import CSV are top-right buttons; period editor opens in a dialog; Import CSV is flagged off (shows "format must be finalised" notice)
- [ ] Homework: Add via top-right button + FAB (dialog); Past homework has a Filters button (status / time range / class; defaults All / This year / All classes)
- [ ] Results analytics: "Failures per subject" donut + "Marks distribution" donut
- [ ] Perf: dashboard drops 2 redundant count queries; stay-back chain self-heal no longer N+1

## Earlier this session

- [ ] Coordinator role: admin-equivalent permissions (class-teacher assignment, message permissions, PTM/stay-back "principal" step)
- [ ] Role label rename: "Teacher" instead of "Class teacher" in permission grid, approval checklists, stay-back page
- [ ] PTM booking approval chain (now 2-step: principal + named teacher)
- [ ] Stay-back approval chain (grade-conditional: 3-step for Grade 8+, 4-step below)
- [ ] Stay-back request form (single reason field, food/transport checkbox, default 16:00–17:00, "Agree & continue")
- [ ] Stay-back request list filter (All time / This year / Last 6 months / This month / This week + Clear filter)
- [ ] Stay-back CSV export (`/api/export/stay-back`) with the new range filter
- [ ] Message send-permissions grid checkbox responsiveness (optimistic toggle)
- [ ] Attendance "mark attendance for today" banner + nav badge (staff console)
- [ ] Reminders tab removal (parent nav, route, cron dispatch, notification settings)
- [ ] Messaging: teacher scoped to own taught classes/students/groups (compose form, custom group creation)
- [ ] Messaging: principal "assign teachers to custom groups" control
- [ ] Messaging: teachers can no longer send whole-school messages

## 2026-08-22 — full feature build

- [ ] PTM meetings & slot booking (staff: create/open/close/delete meeting, open slots; parent: book/cancel slot)
- [ ] PTM delete-meeting guard (blocked while any slot is booked/pending)
- [ ] Stay-back consent (staff approval queue, WhatsApp nudge link)
- [ ] Leave requests (parent raise, staff approve/decline)
- [ ] Messages compose + send permissions admin page (pre-scoping overhaul baseline)
- [ ] Custom groups (create, save-as-group from a selection)
- [ ] Homework tracker (parent view, staff assign/edit/delete)
- [ ] Competitions section (parent view, staff manage)
- [ ] Defaulter room (parent view, staff record incident)
- [ ] Report an issue (parent submit, staff console/issues queue)
- [ ] Notification preferences (per-category push toggle)
- [ ] Google Sheets roster/academic-config sync (staff console/sync, pending-deletion confirm)
- [ ] Login: email/password, phone OTP, Google OAuth
- [ ] Global child switcher (multi-child parent accounts)
- [ ] Daily cron tick (`/api/cron/tick` — sheet sync)

## 2026-08-03

- [ ] Console alerts box (low attendance, pending leave/stay-back, absent today, low scores) — layout/scroll cap
- [ ] Leave/stay-back approvals scoped to the named teacher
- [ ] Timetable day view

## 2026-08-02

- [ ] Timetable (parent view, staff weekly grid editor)
- [ ] Results entry and viewing (staff enter marks, parent view report card)
- [ ] Gallery (staff upload, parent view)
- [ ] Class management (assign class teacher per section)
- [ ] Parent home dashboard (alerts, calendar widget)

## 2026-08-01

- [ ] Attendance marking (staff) and viewing (parent)
- [ ] Messages inbox (parent, unread badge, read receipts)

## 2026-07-31 — initial commit

- [ ] QR codes (staff console)
- [ ] Defaulter records (staff, initial)
- [ ] Results (parent, initial)
- [ ] Payments (parent view)
- [ ] Gallery (parent, initial)
- [ ] Dates to Remember / DTR calendar (parent view, holiday/exam/event categories)
