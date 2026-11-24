# Code Lab

A self-paced, belt-style coding platform for a school computer lab (grades 6–11).
One lab machine runs the server; students open it in a browser over the school LAN.
Nothing needs the internet: the editor, Python runtime and block editor are all served locally.

```
 Student browsers ──LAN──▶  Next.js :3000  ──localhost──▶  Fastify API :4000  ──▶  PostgreSQL :5432
                            (pages + /api proxy)           (auth, progress)
```

Student code **runs in each student's browser** (JavaScript in a Web Worker, Python in
[Pyodide](https://pyodide.org)), so the server never executes student code, and one
student's infinite loop can't slow down anyone else.

## The learning path

| Belt | Focus | Editor |
|---|---|---|
| White, Yellow | Sequences, variables, loops, conditionals | Blockly |
| Orange | Functions; see your blocks as JavaScript | Blockly + JS view |
| Green, Blue, Purple | JavaScript: variables → loops/arrays/functions → objects/algorithms | Monaco |
| Brown, Red | Python basics → lists, dicts, functions | Monaco + Pyodide |
| Black | Capstone project, approved by the teacher | Monaco |

Specialty tracks open once a belt is earned: **AI Literacy** (Yellow), **Cybersecurity** (Orange),
**Web Development** (Green).

Rules: a belt opens when every lesson in the belts before it is done; lessons inside a belt or
track open one at a time.

Lesson kinds:
- **code**: passes when the program's output matches the goal (HTML lessons: required elements exist)
- **quiz**: multiple choice, graded on the server
- **capstone**: student submits, teacher approves or sends back feedback

## Setup on the lab machine

Needs **Node.js 22+** and **PostgreSQL 15+**.

1. **Install PostgreSQL** (pick one):
   - Native: install from postgresql.org, then create the database:
     ```sql
     CREATE USER codelab WITH PASSWORD 'codelab';
     CREATE DATABASE codelab OWNER codelab;
     ```
   - Docker: `docker compose up -d`
2. **Configure:** copy `.env.example` to `.env` and set `JWT_SECRET` to a long random string:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Install, create tables, load lessons:**
   ```
   npm install
   npm run db:migrate
   npm run db:seed
   ```
   This creates the teacher account from `.env` (`teacher` / `changeme` by default). Change
   that password on the **My account** page after logging in.
4. **Run:**
   - Day to day: `npm run build` once, then `npm start`
   - While editing the code: `npm run dev`
5. **Students connect** to `http://<lab-machine-name-or-IP>:3000`. On Windows, allow port 3000
   through the firewall for the **Private** network profile only:
   ```
   netsh advfirewall firewall add rule name="Code Lab" dir=in action=allow protocol=TCP localport=3000 profile=private
   ```
   The API (4000) and database (5432) listen only on localhost and stay closed to the network.

## Teacher workflow

- **Add students:** Teacher → *Add students*. Paste one per line:
  `username, Display Name, grade, password` (grade and password optional, with a shared
  default password).
- **Class view:** every student's belt, XP, progress per belt and last activity. Refreshes every 30s.
- **Student page:** see the code for each lesson, reset a password, turn an account off.
- **Reviews:** approve capstones or send them back with feedback.
- **Preview lessons:** teachers can open any lesson, locked or not.

## Editing the curriculum

All lessons live in [`server/src/curriculum.ts`](server/src/curriculum.ts). Edit, then run
`npm run db:seed`. Lessons are matched by `slug`, so student progress is kept; a lesson removed
from the file is deleted from the database along with its progress.

## Project layout

```
server/                  Fastify API (TypeScript, run with tsx)
  db/migrations/*.sql    schema; `npm run db:migrate` applies new files in order
  src/curriculum.ts      belts, tracks, lessons
  src/progression.ts     unlock rules, XP, earned belt
  src/routes/            auth, lessons, teacher
web/                     Next.js (App Router) + Tailwind
  app/                   login, dashboard, lesson/[slug], teacher, account
  components/            BlocklyEditor, CodeEditor (Monaco), Markdown, BeltBadge
  lib/runners/           JS + Python runners (Web Worker inside a sandboxed iframe)
  server.mjs             starts Next.js; passes each student computer's real IP to the API
  scripts/copy-assets.mjs  copies Monaco, Pyodide and Blockly media into public/ on install
```

## Known limits and next steps

- Output checks run in the browser and are confirmed by the server. A determined student with
  dev tools could fake a pass. The teacher can read every student's code; for graded work, use
  capstone review.
- Python `input()` isn't supported yet (lessons use variables instead).
- Only Pyodide's standard library is bundled. Packages like numpy would need to be downloaded
  into `web/public/pyodide/`.
- Ideas: a Turtle/canvas output for graphics lessons, a teacher lesson editor in the UI,
  class/section groups, CSV export of progress, and packaging as an installer for
  Windows/macOS/Linux lab machines.
