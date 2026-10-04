# OMG Clinic — Release Readiness

This branch is the product hardening branch for the sellable clinic SaaS.

## Core flows
- Authentication and clinic setup
- Role-based access and staff accounts
- Per-doctor consultation/follow-up pricing with clinic defaults
- Today Clinic: booking, check-in, waiting, in-consultation, completed, cancelled/no-show
- Clinical workspace, prescriptions, investigations and medical files
- Patient longitudinal medical record
- Dental suite: chart, treatment plan, sessions, periodontal, media, 3D twin and copilot
- Automatic visit invoices, partial/full payments, receipts, debts and expenses
- Cash shifts and financial reporting
- Operational reports
- WhatsApp inbox metadata workflow
- Representative visits

## Pricing rule
Doctor pricing is authoritative when configured. Clinic pricing is a fallback only. Every completed visit stores a pricing snapshot so historic invoices do not change when prices change later.

## Release gates
Before production sale/deployment:
1. Run npm install, npm run build and npm run lint locally/CI.
2. Test owner, doctor, reception and nurse permissions using separate accounts.
3. Test booking -> check-in -> visit -> invoice -> partial payment -> final payment -> report.
4. Test new consultation and follow-up windows for two doctors with different prices.
5. Test responsive layouts on desktop, tablet and mobile.
6. Review Firebase RTDB security rules against all paths used by this branch.
7. Configure production Firebase project, authorized domains, backups and monitoring.
8. Replace demo/sample data and verify clinic identity/prescription print settings.

## Design direction
The UI uses a shared clinical design foundation: dense but readable information hierarchy, clear states, restrained surfaces, RTL-first typography and consistent financial/clinical status semantics.
