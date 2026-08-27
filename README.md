# EBENEZER 2026 — Christ Ascension Church Unity Convention Archive

A free, professional-grade website for Christ Ascension Church (Lifters
Power Assembly) to share every photo and speaker from the EBENEZER 2026
Unity Convention with members who couldn't attend in person.

- **Home page** — convention banner, live stats (real photo/session/speaker
  counts), schedule, a preview of recent photos
- **Gallery page** — every photo, grouped into sessions, **paginated at 30
  photos per page**, with search, sort, grid/list view, and a full-screen
  carousel viewer with Download + Save to Favorites
- **Speakers page** — every speaker who has ministered at the convention,
  each with a photo, title, and tag, browsable in the same carousel viewer
- **Favorites** — visitors can heart any photo or speaker; saved locally on
  their own device (no account needed) and browsable as their own
  "Your Favorites" session on the Gallery page
- **About page** — the church's story and the meaning behind "Ebenezer"
- **Admin page** (`/admin.html`) — a password-protected dashboard where the
  convention media team uploads photos and manages speakers **directly from
  a phone or laptop browser** — no GitHub, no command line, no coding, ever.
  Includes a real-time storage usage widget.

Photos, speaker records, and speaker photos are all stored in **Vercel
Blob** (free storage tier, no separate account needed — it's built into
Vercel).

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

**Start here — visit `/api/health` on your live site** (e.g.
`https://ebenezer-2026.vercel.app/api/health`). It reports whether the
server can see your password and your storage connection, without needing
to attempt an upload at all:

```json
{ "adminPasswordConfigured": true, "blobTokenConfigured": true }
```

If either says `false`, that's the fix needed — set/reconnect it in
Vercel, then **redeploy** (environment variable changes only apply to the
next deployment, never the currently-running one).

**"Upload failed" with a specific message:** as of this version, every
upload failure shows the real reason next to the photo (not just
"failed") — e.g. incorrect password, missing configuration, or file still
too large. Whatever it says is the actual problem to fix.

**Large photos:** the admin page automatically shrinks photos in the
browser before sending them, so normal phone photos should never hit a
size limit.

## Editing page text

All page text lives directly in plain HTML files:

- `public/index.html` — home page copy, schedule
- `public/about.html` — church history, convention description
- `public/gallery.html` — gallery page header text
- `public/speakers.html` — speakers page header text

Open any of these in GitHub's built-in editor (pencil icon), make your
change, and commit — Vercel redeploys automatically. This is the one part
of the site that still goes through GitHub, since it's website design/copy
rather than day-to-day photo uploads.

---

## Public photo submissions

Anyone can share a photo without a password at `/submit.html` — linked from
the footer and the Gallery toolbar on every page. Submitted photos do
**not** go public immediately: they land in a review queue.

In the admin dashboard, **Review Submissions** in the sidebar shows every
pending photo with who submitted it (if they gave a name) and when. Click
**Approve** to move it into the real gallery under the session it was
submitted for, or **Reject** to discard it. A red badge on the sidebar
link shows how many are waiting.

**A note on abuse:** the submit endpoint is intentionally open (no
password) so real visitors can use it easily. It includes a basic
honeypot field to filter simple bots, but a determined bad actor could
still spam it — anything submitted always lands in the pending queue
first, never directly on the public gallery, so the worst case is you
have some junk to reject rather than junk going live. If spam becomes a
real problem, consider adding a password to the submit page too.

---

## Social sharing & installing as an app

- Every page has Open Graph/Twitter preview tags, so links shared in
  WhatsApp, Facebook, etc. show your convention banner with a title and
  description instead of a blank link.
- These tags currently point to `https://ebenezer2026.vercel.app` — if
  your site ends up on a different domain, update the `og:url`,
  `og:image`, `twitter:image`, and `<link rel="canonical">` values across
  `index.html`, `gallery.html`, `speakers.html`, `about.html`, and
  `submit.html` to match.
- The site has a `manifest.json` and app icons, so phones will offer
  "Add to Home Screen" — it opens full-screen like a native app.

---

## Managing speakers

From the admin dashboard, click **Manage Speakers** in the sidebar:

1. Enter the speaker's name (required), title/ministry, and a tag (e.g.
   "Guest Minister", "Convener", "Elder")
2. Add a photo — same automatic compression as photo uploads
3. Click **Add Speaker**

They appear on the public `/speakers.html` page immediately. To remove a
speaker, find them in the "Current speakers" grid in the same panel and
click Delete.

---

## Favorites (for visitors)

Anyone browsing the Gallery or Speakers page can click the heart icon on
any photo or speaker to save it — this is stored only in their own
browser (`localStorage`), not on the server, so it's private to their
device and requires no account. Saved photos appear under the
**"♥ Your Favorites"** entry in the Gallery's session dropdown.

---

## Project structure

```
ebenezer2026/
├── public/
│   ├── index.html          Home page
│   ├── gallery.html        Photo archive page (album cards + pagination)
│   ├── speakers.html       Speakers page
│   ├── about.html          About page
│   ├── submit.html         Public photo submission page (no password)
│   ├── submit.js           Submission form logic
│   ├── admin.html          Password-protected media team dashboard
│   ├── admin.js            Upload / manage photos / speakers / review submissions
│   ├── styles.css          All site styling (single unified theme)
│   ├── site.js             Shared nav behavior
│   ├── gallery.js          Gallery rendering, pagination, carousel lightbox
│   ├── speakers.js         Speakers rendering + carousel lightbox
│   ├── favorites.js        Shared client-side favorites (localStorage)
│   ├── share.js            Shared "Share" (native share sheet / WhatsApp)
│   ├── img-compress.js     Shared client-side photo compression
│   ├── home-preview.js     Home page stats + recent photos
│   ├── manifest.json       PWA manifest ("Add to Home Screen")
│   └── images/             Crest, convention banner, speaker photos, app icons
├── api/
│   ├── upload.js                Serverless function: receives + stores photos
│   ├── gallery.js                Serverless function: lists all stored photos
│   ├── delete.js                 Serverless function: removes a photo
│   ├── speakers.js               Serverless function: lists all speakers
│   ├── speakers-save.js          Serverless function: adds a speaker
│   ├── speakers-delete.js        Serverless function: removes a speaker
│   ├── submit.js                 Public: accepts a photo submission (pending queue)
│   ├── submissions.js            Admin: lists pending submissions
│   ├── submissions-approve.js    Admin: moves a submission into the gallery
│   ├── submissions-reject.js     Admin: discards a submission
│   └── health.js                 Diagnostic endpoint — visit /api/health to check config
├── lib/
│   ├── speakers-store.js     Shared read/write helper for the speakers JSON index
│   └── submissions-store.js  Shared read/write helper for the pending-submissions index
├── package.json             Declares the @vercel/blob dependency
├── vercel.json              Vercel configuration
└── README.md                 This file
```

No database to manage, no paid plan required, and no ongoing maintenance
beyond uploading photos, managing speakers, and reviewing submissions
through the admin dashboard.
