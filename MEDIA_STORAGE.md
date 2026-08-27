# Production media storage (Video + PDF)

Ohm's English does **not** store lesson videos/PDFs in Firebase.  
Firebase is only for **push notifications (FCM)**.

Production media uses **MongoDB GridFS** so files survive Render redeploys.

## Pipeline

```text
Admin Panel Upload
    → Backend API (/api/admin/upload/video|pdf)
    → Temp disk (multer)
    → MongoDB GridFS (permanent bytes)  ← verified before success
    → MongoDB courses.lessons (videoUrl / pdfUrl)
    → App API GET /api/courses
    → Mobile App play / download
    → GET /uploads/... streams from GridFS
```

## Step-by-step

### 1. Admin Panel
- Upload video → `POST /api/admin/upload/video`
- Upload PDF → `POST /api/admin/upload/pdf`
- Save lesson with returned `videoUrl` + `pdfUrl`

### 2. Backend API
- Multer writes a temp file under `backend/uploads/videos|pdfs`
- `uploadService` requires GridFS to be ready
- File is copied into GridFS bucket `uploads`
- Upload fails if GridFS verify fails (no silent success)

### 3. File storage (GridFS)
- Filename keys: `videos/<name>.mp4`, `pdfs/<name>.pdf`
- Served at: `https://<PUBLIC_HOST>/uploads/<path>`
- Supports HTTP Range (seeking in video players)

### 4. MongoDB lesson docs
Store **URLs only**, for example:

```json
{
  "title": "Lesson 1",
  "videoUrl": "https://aarambh-api.onrender.com/uploads/videos/....mp4",
  "pdfUrl": "https://aarambh-api.onrender.com/uploads/pdfs/....pdf"
}
```

### 5. App API
`GET /api/courses` returns lessons with live URLs when GridFS has the file.

### 6. Mobile app
- Play: Expo AV loads `videoUrl`
- PDF: downloads `pdfUrl` to device storage

## Production checklist (Render)

1. `MONGODB_URI` points at Atlas (persistent)
2. `RENDER_EXTERNAL_URL` / public URL is set (canonical media links)
3. After deploy, `/health` shows `mediaFiles` > 0 once lessons are uploaded
4. `/health/media` lists GridFS files + lesson status
5. Admin re-uploads any lesson marked missing after an old wipe

## Limits
- Video max: 100MB
- PDF max: 20MB

## Emergency only
Set `MEDIA_SAMPLE_HEAL=true` only for temporary sample recovery.  
Do **not** use this for real production content — re-upload real files from admin instead.
