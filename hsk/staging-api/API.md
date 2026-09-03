# HSK staging API contract

This directory is integration-ready code, not a production deployment.

## Safety boundary

- Apply `migrations/0001_hsk_exam_hskk.sql` only to the D1 binding used by `aluni-tts-staging`.
- Do not apply it to the production D1 database until the test flow is approved.
- The module does not create or modify course, lesson, vocabulary, reading, game, or grammar records.
- Admin routes require the existing Aluni Worker authentication layer to pass `{ isAdmin: true, actor }`.
- DELETE is a recoverable soft delete; it sets `deleted_at` and keeps an audit row.

## Public routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/hsk/exams` | Published exam sets |
| GET | `/hsk/exams/:id` | One published exam without answers |
| GET | `/hsk/hskk` | Published HSKK sets |
| GET | `/hsk/hskk/:id` | One published HSKK practice set |

## Admin routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/hsk-admin/exams` | List non-deleted exam sets |
| POST | `/hsk-admin/exams/import` | Upsert one exam and its questions |
| PATCH | `/hsk-admin/exams/:id` | Set `draft`, `published`, or `hidden` |
| DELETE | `/hsk-admin/exams/:id` | Soft-delete an exam |
| GET | `/hsk-admin/hskk` | List non-deleted HSKK sets |
| POST | `/hsk-admin/hskk/import` | Upsert one HSKK set, prompts, and criteria |
| PATCH | `/hsk-admin/hskk/:id` | Set `draft`, `published`, or `hidden` |
| DELETE | `/hsk-admin/hskk/:id` | Soft-delete an HSKK set |

## Worker integration

Import `handleHskRequest` into the current Worker entrypoint. After the existing authentication step and before the final 404 response:

```js
const hskResponse = await handleHskRequest(request, env, {
  isAdmin: currentUser?.role === 'admin',
  actor: currentUser?.email || currentUser?.id || ''
});
if (hskResponse) return hskResponse;
```

The real Worker source and authentication contract must be inspected before adapting this snippet or deploying staging.
