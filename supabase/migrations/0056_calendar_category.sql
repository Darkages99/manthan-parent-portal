-- New calendar events push a notification to the guardians they are for
-- (src/lib/calendar-notify.ts). Own category so parents can turn it off.
alter type notification_category add value if not exists 'calendar';
