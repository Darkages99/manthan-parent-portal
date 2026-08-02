-- ---------------------------------------------------------------------------
-- Restore the guardian UPDATE policy on message_receipts. It exists in
-- 0001_init.sql but was missing from the deployed database (the RLS policies
-- were originally applied as separate migrations that predate this repo's
-- migration history and never included it), so guardians could never mark
-- their own receipts read: the UPDATE in markMessagesRead() ran but matched
-- zero rows under RLS, silently leaving the sidebar unread badge stuck.
-- ---------------------------------------------------------------------------

drop policy if exists "guardian updates own receipts" on message_receipts;
create policy "guardian updates own receipts" on message_receipts for update
  using (guardian_id = current_guardian_id())
  with check (guardian_id = current_guardian_id());
