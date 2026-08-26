-- Reported-issue visibility redesign.
--
-- Replaces the single `confidential` boolean (0019) with a richer model:
--   * audience: who a non-directed report reaches
--       - principal_only            -> principal / super_admin / coordinator only
--       - front_office_and_principal -> the above PLUS front office
--   * reported_issue_recipients: specific teacher(s) a report is directed to.
--
-- A directed report is visible to those teacher(s) + front office + principal,
-- so the app forces audience = front_office_and_principal whenever recipients
-- are attached. Note: general (non-directed) reports are NO LONGER visible to
-- every teacher — only front office / principal, matching the requested model.

create type issue_audience as enum ('principal_only', 'front_office_and_principal');

alter table reported_issues
  add column audience issue_audience not null default 'front_office_and_principal';

-- Carry the old boolean forward, then drop it. The old policies reference the
-- column, so they must be dropped first.
update reported_issues
  set audience = case
    when confidential then 'principal_only'::issue_audience
    else 'front_office_and_principal'::issue_audience
  end;

drop policy if exists "staff reads non-confidential issues" on reported_issues;
drop policy if exists "principal reads confidential issues" on reported_issues;
drop policy if exists "staff updates issues" on reported_issues;

alter table reported_issues drop column confidential;

-- Teacher(s) a report is directed to.
create table reported_issue_recipients (
  issue_id uuid not null references reported_issues (id) on delete cascade,
  staff_id uuid not null references staff (id) on delete cascade,
  primary key (issue_id, staff_id)
);

alter table reported_issue_recipients enable row level security;

-- security-definer helper: is the signed-in staff member a target of this issue?
-- (mirrors current_guardian_id()/is_staff() in 0001 — bypasses RLS, so it can be
-- referenced from reported_issues policies without recursion.)
create or replace function public.current_staff_is_issue_recipient(p_issue uuid)
  returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists(
    select 1 from reported_issue_recipients
    where issue_id = p_issue and staff_id = current_staff_id()
  )
$function$;

-- ---------------------------------------------------------------------------
-- reported_issues policies (the confidential-based ones were dropped above)
-- ---------------------------------------------------------------------------

-- reporter (guardian or staff) always reads their own reports
drop policy if exists "reporter reads own issues" on reported_issues;
create policy "reporter reads own issues" on reported_issues for select
  using (
    (reported_by_guardian_id is not null and reported_by_guardian_id = current_guardian_id())
    or (reported_by_staff_id is not null and reported_by_staff_id = current_staff_id())
  );

-- principal / super_admin / coordinator read everything
drop policy if exists "principal reads all issues" on reported_issues;
create policy "principal reads all issues" on reported_issues for select
  using (current_staff_role() in ('principal', 'super_admin', 'coordinator'));

-- front office reads reports shared with them ('admin' is the legacy front-office label)
drop policy if exists "front office reads shared issues" on reported_issues;
create policy "front office reads shared issues" on reported_issues for select
  using (
    current_staff_role() in ('front_office', 'admin')
    and audience = 'front_office_and_principal'
  );

-- a directed teacher reads the reports pointed at them
drop policy if exists "targeted teacher reads directed issues" on reported_issues;
create policy "targeted teacher reads directed issues" on reported_issues for select
  using (is_staff() and current_staff_is_issue_recipient(id));

-- inserts (unchanged intent, re-declared for clarity)
drop policy if exists "guardian raises own issue" on reported_issues;
create policy "guardian raises own issue" on reported_issues for insert
  with check (reported_by_guardian_id = current_guardian_id());

drop policy if exists "staff raises own issue" on reported_issues;
create policy "staff raises own issue" on reported_issues for insert
  with check (reported_by_staff_id = current_staff_id());

-- staff may resolve an issue they are allowed to see
create policy "staff resolves visible issues" on reported_issues for update
  using (
    current_staff_role() in ('principal', 'super_admin', 'coordinator')
    or (current_staff_role() in ('front_office', 'admin') and audience = 'front_office_and_principal')
    or current_staff_is_issue_recipient(id)
  )
  with check (is_staff());

-- ---------------------------------------------------------------------------
-- reported_issue_recipients policies
-- ---------------------------------------------------------------------------

-- Anyone who can read the parent issue can read its recipient list. The inner
-- select runs under the caller's RLS on reported_issues, so recipient rows are
-- only visible when the issue itself is (works for guardians and staff alike).
drop policy if exists "reads recipients of visible issues" on reported_issue_recipients;
create policy "reads recipients of visible issues" on reported_issue_recipients for select
  using (exists (select 1 from reported_issues i where i.id = issue_id));

-- The reporter (guardian or staff) may attach recipients to their own issue.
drop policy if exists "reporter adds recipients to own issue" on reported_issue_recipients;
create policy "reporter adds recipients to own issue" on reported_issue_recipients for insert
  with check (
    exists (
      select 1 from reported_issues i
      where i.id = issue_id
        and (
          i.reported_by_guardian_id = current_guardian_id()
          or i.reported_by_staff_id = current_staff_id()
        )
    )
  );
