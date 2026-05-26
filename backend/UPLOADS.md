# Local uploads (videos & PDFs)

## Web dashboard (easiest)

**https://aarambh-api.onrender.com/admin/**

Log in with admin username & password → upload video/PDF → add lesson to a course.

---

Cloudinary has been removed. Files are stored under `backend/uploads/` and served at `/uploads/...`.

## Admin upload (Bearer token, admin role)

**Video** — `POST /api/admin/upload/video`  
`multipart/form-data`, field name: `video`

**PDF** — `POST /api/admin/upload/pdf`  
`multipart/form-data`, field name: `pdf`

### Response (30s delay before app can play)

```json
{
  "success": true,
  "data": {
    "url": "http://localhost:5000/uploads/videos/lesson-123.mp4",
    "videoUrl": "...",
    "availableAt": "2026-05-25T12:00:30.000Z",
    "availableInSeconds": 30,
    "videoAvailableAt": "2026-05-25T12:00:30.000Z"
  },
  "message": "Video uploaded. Available in app in 30 seconds."
}
```

Save `videoUrl` + `videoAvailableAt` (or `pdfUrl` + `pdfAvailableAt`) on the lesson via `POST /api/admin/courses/:id/lessons`.

`GET /api/courses` hides `videoUrl` / `pdfUrl` until `availableAt` has passed and returns `videoAvailableIn` / `pdfAvailableIn` (seconds left).

## Folders

| Folder | Content |
|--------|---------|
| `uploads/videos/` | Lesson videos |
| `uploads/pdfs/` | Lesson PDFs |
| `uploads/avatars/` | Profile images |
