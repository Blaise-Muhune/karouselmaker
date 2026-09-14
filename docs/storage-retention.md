# Storage retention

Karouselmaker stores user assets and rendered exports in the private `carousel-assets` bucket. Paths are scoped to each account.

- User-uploaded library assets stay until the user removes them.
- A normal rendered export is temporary and is removed after one day.
- A TikTok scheduled-post snapshot is protected while scheduled or publishing, then retained for seven days after it finishes for diagnostics.
- Deleting a carousel or project removes all of its rendered export files before deleting the database records. Project library assets remain in the user library.

`/api/cron/storage-cleanup` runs daily and removes up to 100 eligible export groups per run. It uses `CRON_SECRET`, the same authorization secret as the other server cron routes. Failed removals retain their database paths and are retried on a later run.
