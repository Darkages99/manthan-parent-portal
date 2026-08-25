-- A homework assignment now has a per-assignment default completion status.
-- checked = false (the default for new homework): nobody has done it yet;
-- a homework_submissions row for a student means "marked done" (an override).
-- checked = true (teacher clicked "Checked"): everybody's done it; a row
-- means "marked not done" (an override). Flipping `checked` always clears
-- existing rows first (see toggleAllChecked in homework/actions.ts) so a
-- prior override never silently flips meaning.
alter table homework_assignments add column checked boolean not null default false;
