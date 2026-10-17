# Estate CRM - Real Estate Lead & Booking Management

A full-stack CRM where a sales team manages leads, property inventory and unit bookings, with Admin and Sales Employee roles.

**Stack:** React (Vite) · Node.js + Express · MongoDB (Mongoose) · JWT auth · Zod validation

**Live app:** `<add your deployed URL>`  **API:** `<add your API URL>`

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@crm.com | Admin@123 |
| Sales employee | priya@crm.com | Sales@123 |

## Run locally
```bash
# 1. API
cd server
npm install
npm run dev:memory      # in-memory MongoDB, seeds demo data (no install needed)
# or: set MONGO_URI in .env to a local MongoDB / Atlas URI and run npm run dev

# 2. Web app (new terminal)
cd client
npm install
npm run dev             # http://localhost:5173
```
The first `dev:memory` run downloads a MongoDB binary (internet needed once). Demo data is seeded automatically when the database is empty.

## Features
- Leads: create, edit, search, filter, paginate; 7 stages (New, Contacted, Site Visit, Interested, Negotiation, Booked, Lost); table and drag-and-drop pipeline views
- Assign leads to employees, add notes, set follow-up dates, full activity timeline
- Properties: projects > buildings > units (type, price, area, availability) with a colour-coded floor grid
- Bookings: connect a lead to a unit; double booking is impossible
- Dashboard: pipeline, follow-ups due/overdue, inventory, lead sources, bookings and value, top performers (admin)
- Auth with Admin and Sales roles; responsive layout; loading, empty and error states everywhere

## Roles
| Action | Admin | Sales |
|---|---|---|
| See leads | all | only own |
| Assign / reassign leads | yes | no |
| Create projects, buildings, units, edit prices, hold units | yes | no |
| Create booking | yes | yes (own leads) |
| Cancel booking | yes | no |
| Manage team | yes | no |

## Key decisions and why
1. **No double booking, two layers.** Booking first does an atomic `findOneAndUpdate({status:'Available'} -> 'Booked')`; only one concurrent request can win. A partial unique index (`unit` where `status='Active'`) on bookings is a database-level safety net, and the claim is rolled back if anything fails.
2. **Sales users only see their own leads, enforced on the server.** Every lead query and every lead endpoint checks ownership, so hiding things in the UI is never the only protection. Only admins can reassign.
3. **"Booked" is controlled by the booking flow.** A lead cannot be dragged to Booked by hand, and a Booked lead cannot be moved away until an admin cancels the booking. This keeps lead stage and unit status consistent. Cancelling returns the unit to Available and moves the lead back to Negotiation.
4. **Accountability by default.** Every stage change, assignment, note and booking writes to an activity timeline. Marking a lead Lost requires a reason so the team can learn from it.
5. **Practical sales-team details.** Duplicate phone numbers are rejected, units can be put on hold, bulk-generate units per building (floors x units), and the dashboard separates overdue from due-today follow-ups.

## Database overview
```
User(name,email,passwordHash,role,active)
Lead(name,phone,email,source,budget,stage,lostReason,assignedTo->User,nextFollowUp,notes[])
Project(name,location) 1-* Building(project,name) 1-* Unit(building,project,unitNumber,floor,type,areaSqft,price,status)
Booking(lead->Lead,unit->Unit,bookedBy->User,amount,status[Active|Cancelled])   unique(unit) where Active
Activity(lead,user,type,message,at)
```

## API overview (all under /api, JWT bearer token except login)
| Method | Path | Who |
|---|---|---|
| POST | /auth/login · GET /auth/me | all |
| GET/POST | /leads | all (sales scoped) |
| GET/PATCH | /leads/:id | owner/admin |
| PATCH | /leads/:id/stage | owner/admin |
| PATCH | /leads/:id/assign | admin |
| POST | /leads/:id/notes | owner/admin |
| GET | /projects · /units | all |
| POST | /projects · /buildings · /units/bulk · PATCH /units/:id | admin |
| GET/POST | /bookings | all (sales scoped) |
| PATCH | /bookings/:id/cancel | admin |
| GET | /dashboard | all (scoped by role) |
| GET/POST/PATCH | /users | admin (GET /users/assignable: all) |

## Deploy
1. **Database:** MongoDB Atlas free cluster -> create a user, allow `0.0.0.0/0`, copy the connection string.
2. **API (Render):** root dir `server`, build `npm install`, start `npm start`. Env: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (your frontend URL). Demo data seeds on first start.
3. **Web (Vercel/Netlify):** root dir `client`, build `npm run build`, output `dist`. Env: `VITE_API_URL` = your Render URL.
