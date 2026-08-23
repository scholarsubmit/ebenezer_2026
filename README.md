# EBENEZER 2026 — Christ Ascension Church Unity Convention Archive

A free website for Christ Ascension Church (Lifters Power Assembly) to share
every photo from the EBENEZER 2026 Unity Convention with members who
couldn't attend in person.

- **Home page** — convention theme, verse, schedule, a preview of recent photos
- **Gallery page** — every photo, grouped into albums, with a full-screen viewer
- **About page** — the church's story and the meaning behind "Ebenezer"
- **Admin page** (`/admin.html`) — a password-protected page where the
  convention media team uploads photos **directly from a phone or laptop
  browser** — no GitHub, no command line, no coding, ever.

Photos are stored in **Vercel Blob** (free storage tier, no separate account
needed — it's built into Vercel).

---

## One-time setup (do this once, takes about 10 minutes)

### 1. Deploy the code to Vercel

The code itself only needs to be pushed to GitHub and deployed **once**.
After that, all day-to-day work (adding/removing photos) happens on the
website itself — you'll never need git again for photos.

1. Create a free account at [github.com](https://github.com) if you don't
   have one, and create a new repository (e.g. `ebenezer-2026`).
2. Upload this entire project folder to that repository (drag-and-drop
   through GitHub's web uploader works fine, or use `git push` if you're
   comfortable with the command line).
3. Go to [vercel.com](https://vercel.com), sign up with **Continue with
   GitHub**, click **Add New → Project**, select your repository, and click
   **Deploy**.
4. You'll get a free live link like `https://ebenezer-2026.vercel.app`.

### 2. Turn on photo storage (Vercel Blob)

1. In your Vercel project dashboard, open the **Storage** tab.
2. Click **Create Database → Blob** and follow the prompts (it's free on
   Vercel's Hobby plan, with generous storage for a church photo archive).
3. When asked, **connect it to this project** — Vercel will automatically
   add a `BLOB_READ_WRITE_TOKEN` environment variable for you. You don't
   need to copy or configure anything manually.

### 3. Set your upload password

1. In your Vercel project, go to **Settings → Environment Variables**.
2. Add a new variable:
   - **Name:** `ADMIN_PASSWORD`
   - **Value:** a password of your choice (share this only with your
     convention media team)
3. Click **Save**.
4. Go to the **Deployments** tab and click **Redeploy** on the latest
   deployment so the new password takes effect.

That's it — setup is done. From here on, everything happens on the site.

---

## Everyday use: uploading photos

1. Visit `https://your-site.vercel.app/admin.html` (there's also a
   "Committee Upload" link in the footer of every page).
2. Enter the password.
3. Choose an existing album (like "Day 1 Opening") or type a new album name
   (like "Youth Night" or "Choir Ministration").
4. Select or drag in photos — you can select many at once.
5. Click **Upload Photos**.

Photos appear on the public Gallery page immediately — no redeploying, no
waiting. Anyone with the site link can view them right away.

To remove a photo, scroll to **Manage existing photos** on the same admin
page, pick the album, and click **Delete** under any photo you want to take
down.

**Tip:** most phone photos work fine as-is, but if someone uploads very
large files (raw camera exports, etc.), keeping individual photos under
~10MB keeps the gallery loading quickly for members on mobile data.

---

## Troubleshooting

**"Upload failed" on large photos:** Vercel's server functions cap request
bodies at 4.5MB. The admin page now automatically shrinks large photos in
the browser (resizing + re-compressing) before sending them, so this
should no longer come up in normal use. If uploads still fail, check that:
- A Blob store is created and connected to the project (Storage tab)
- `ADMIN_PASSWORD` is set under Settings → Environment Variables
- The site was redeployed *after* adding the Blob store / password (env
  var changes only take effect on the next deploy)

**Upload just says "Uploading…" and never finishes:** this usually means
the request never reached the server at all — check the same three things
above, and check your internet connection. The status text will always
update to a specific ✓ or ✕ result within a few seconds per photo once
those are correct.

## Editing page text

All page text lives directly in plain HTML files:

- `public/index.html` — home page copy, schedule
- `public/about.html` — church history, convention description
- `public/gallery.html` — gallery page header text

Open any of these in GitHub's built-in editor (pencil icon), make your
change, and commit — Vercel redeploys automatically. This is the one part
of the site that still goes through GitHub, since it's website design/copy
rather than day-to-day photo uploads.

---

## Project structure

```
ebenezer2026/
├── public/
│   ├── index.html          Home page
│   ├── gallery.html        Photo archive page
│   ├── about.html          About page
│   ├── admin.html          Password-protected photo upload page
│   ├── admin.js            Upload page logic
│   ├── styles.css          All site styling
│   ├── site.js             Shared nav behavior
│   ├── gallery.js          Gallery rendering + lightbox
│   ├── home-preview.js     Home page photo preview
│   └── images/logo.png     Church crest
├── api/
│   ├── upload.js           Serverless function: receives + stores photos
│   ├── gallery.js          Serverless function: lists all stored photos
│   └── delete.js           Serverless function: removes a photo
├── package.json             Declares the @vercel/blob dependency
├── vercel.json              Vercel configuration
└── README.md                 This file
```

No database to manage, no paid plan required, and no ongoing maintenance
beyond uploading and (occasionally) deleting photos through the admin page.
