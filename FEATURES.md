# Feature testing tracker

Every feature in the app, grouped by when it was last touched (most recent
first). Everything is marked **untested** — including PTM and stay-back,
which had earlier passes but need a full retest after this round of changes.
Test in this order, top to bottom.

Legend: `[ ]` untested · `[x]` tested and working · `[!]` tested, found an issue

## Uncommitted — this session

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
