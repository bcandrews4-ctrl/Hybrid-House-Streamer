One‑click deploy and hosting

Render (recommended)
1) Push this folder to a new GitHub repo.
2) Go to render.com → New + → Web Service → Connect your repo.
3) Settings:
   - Runtime: Node
   - Build Command: (leave blank)
   - Start Command: node server.js
   - Environment Variables (optional for login):
     - BASIC_AUTH_USER
     - BASIC_AUTH_PASS
4) Create Web Service → wait for green. Your app is live at the provided URL.

One‑click via render.yaml
You can also click “New + → Blueprint” and point Render at this repo. It will read render.yaml.

Local run
1) npm install
2) npm start
3) Open http://localhost:3000

Auth (optional)
Set BASIC_AUTH_USER and BASIC_AUTH_PASS to require a browser login to access the dashboard and casts.

