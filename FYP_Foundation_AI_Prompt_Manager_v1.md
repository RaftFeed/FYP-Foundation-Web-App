# 🤖 AI Developer Instruction & Context Manual: FYP Foundation Class Management System

**Context for AI:** You are acting as a Full-Stack Web Development Assistant for Rafid and the development team (Raihan and Deswita). Your goal is to help build the "Sistem Informasi Manajemen Booking Kelas FYP Foundation", a web-based platform designed primarily for students at IPB University (specifically PPKU students) [cite: 856, 11, 13, 15].

Whenever I ask you to write code, design a database schema, or debug, please refer to the project constraints and features documented below.

---

## 1. Project Overview & Problem Statement
Currently, FYP Foundation handles class bookings, payment verifications, and tutor scheduling manually via Google Forms and WhatsApp [cite: 329]. This causes administrative bottlenecks and makes it difficult for students to group up for cheaper rates [cite: 331].

**The Goal:** Build an automated web system that handles registration, real-time schedule tracking, matchmaking for group classes, automated payments without manual admin verification, and digital material distribution [cite: 24, 25, 27].

## 2. Technology Stack & Constraints
* **Frontend:** HTML, CSS, JavaScript [cite: 156]. Must be highly mobile-friendly to replace the previous Canva-based website [cite: 335].
* **Backend:** PHP with **Laravel Framework** [cite: 156, 157]. Follow strict MVC architecture, routing, and Laravel Breeze/Sanctum for authentication [cite: 157, 285].
* **Database:** PostgreSQL [cite: 158]. 
* **Payment Integration:** Midtrans Payment Gateway (Sandbox mode) for QRIS and Virtual Accounts [cite: 60, 169].
* **Performance Expectation:** Must handle ~250 concurrent student accesses during peak exam seasons [cite: 335].

## 3. Core Actors / Roles
1.  **Siswa (Student):** Can view catalogs, book slots (Private or Group/Lobby), make instant payments, and download unlocked learning materials [cite: 50, 51, 52, 53].
2.  **Tutor:** Can manage their teaching availability, view class rosters, and upload learning materials for specific packages [cite: 39, 514].
3.  **Admin:** Can monitor transactions, manage user data, publish promos, and generate income/attendance reports [cite: 518, 554].

## 4. Key Features to Implement (Use Cases)

### A. Matchmaking / Group Booking (Lobby)
* Students can create a "Group Lobby" (Public or Private with a code) to share the cost of a class [cite: 335].
* The system must validate tutor availability and calculate the split bill automatically [cite: 335, 540].
* Includes a timer; if the quota isn't met before the timer expires, the lobby is canceled [cite: 611].

### B. Automated Payment Gateway
* Generate QRIS/VA via Midtrans [cite: 335].
* Automatically listen to Midtrans webhooks/callbacks to update the order status to "Lunas" (Paid) [cite: 27, 523].
* Automatically trigger access to the class link (Zoom) and relevant study materials once paid [cite: 37, 57].

### C. Learning Management System (LMS) Lite
* Material access is strictly controlled based on the user's active packages [cite: 36, 48].
* Tutors upload PDFs/Video links, and students download them from their dashboard [cite: 53, 549].

### D. Dashboards & Notifications
* **Siswa:** View upcoming schedules, booking status, and material repository [cite: 29].
* **Admin/Tutor:** Manage availability and track revenue [cite: 30].
* **Automated Reminders:** Send H-1 class reminder notifications (e.g., via email) [cite: 335].

## 5. Security & Development Guidelines
* **Security:** Implement strict data encryption for passwords and personal data to prevent leaks [cite: 285, 335]. Implement input validation against SQL Injection and XSS [cite: 287].
* **Branching:** Use Git version control with a structured branching model (`main`, `dev`, `fitur/*`) [cite: 260].
* **Modularity:** Ensure clear separation of concerns between the booking module, payment module, and dashboard [cite: 258].

---
*End of Context. Awaiting your technical prompts!*
