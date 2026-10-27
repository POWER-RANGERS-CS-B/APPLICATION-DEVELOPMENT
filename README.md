# DineAri - Cross-Platform Restaurant Management System

Team Roles & Responsibilities
- Team Leader: Gwynyth Edzcharyz Q Gomonit
- Developer: Guy Magcanta
           : Glenn Gabriel Sanchez
- Quality Assurance (QA): Zaira M. Alumbro
- Project Manager: Kimberly O. Carin

---

## 🗄️ Database Setup (PostgreSQL)
1. In PostgreSQL, run: `CREATE DATABASE dinequeue_db;`
2. Connect to `dinequeue_db` and execute:
  create schema 'restaurant'

---

## ⚙️ Backend Setup (Node.js & Express)
1. Open terminal in `/backend`
2. Run `npm install`
3. Copy `.env.example` to `.env` and set your `DB_PASSWORD`
4. Run `npm run dev` (Server runs on port 3000)

### Security checks
- Run the backend security tests with `npm test` from `/backend`.
- Run the dependency audit with `npm run security:check` from `/backend`.
- GitHub Actions runs both checks and CodeQL analysis on pushes and pull requests. Dependabot checks npm and GitHub Actions dependencies weekly.

---

## 🔑 Sample Login Credentials
- Admin: `admin@dinequeue.com` | Password: `admin123`
- Staff: `staff@dinequeue.com` | Password: `admin123`
