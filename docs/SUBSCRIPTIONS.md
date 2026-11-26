# Clinova subscriptions — implementation contract

- One subscription per clinic: **800 EGP/month**, or **9,600 EGP/year** without discount.
- **No free trial**. New clinics must start with inactive subscription.
- RTDB path: `clinicSubscriptions/{clinicId}`. Fields: `status: "active" | "suspended"`, `currentPeriodStart` (ISO UTC), `currentPeriodEnd` (ISO UTC), `billingInterval: "monthly" | "yearly"`, `updatedAt`.
- Only a trusted backend (Firebase Admin SDK) may create, renew, suspend or mark payments as settled. Never trust client timestamps or payments.
- Super Admin users require **Firebase Auth custom claim** `superAdmin: true`, provisioned server-side only.
- **Critical before launch**: RTDB security rules must enforce admin-only read/write for subscription records, admin-only clinic directory reads, and a valid active subscription for all clinic data mutations. Client-side route guards alone are not security.
- Existing clinics need an explicit migration decision (paid activation vs temporary manual grace). No implicit trials or silent deletion.
- Keep clinical data available for safe export after expiry; do not delete it. Define read-only behavior and an appropriate retention policy.
- The admin screen currently provides **read-only monitoring**. Backend provisioning, secure payment verification, renewal actions, RTDB rules, and end-to-end tests are outstanding. Do not sell subscriptions as technically enforced until these are completed.
