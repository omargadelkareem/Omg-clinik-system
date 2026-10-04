import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import MainLayout from "../layouts/MainLayout";
import DashboardPage from "../pages/DashboardPage";
import AppointmentsPage from "../pages/appointments/AppointmentsPage";
import PatientsPage from "../pages/patients/PatientsPage";
import PatientProfilePage from "../pages/patients/PatientProfilePage";
import NewVisitPage from "../pages/visits/NewVisitPage";
import PrescriptionsPage from "../pages/prescriptions/PrescriptionsPage";
import DrugLibraryPage from "../pages/drugs/DrugLibraryPage";
import FinancePage from "../pages/finance/FinancePage";
import ReportsPage from "../pages/reports/ReportsPage";
import StaffPage from "../pages/staff/taffPage";
import SettingsPage from "../pages/settings/SettingsPage";
import SetupClinicPage from "../pages/setup/SetupClinicPage";
import VisitsPage from "../pages/visits/VisitsPage";
import MedicalFilesPage from "../pages/medical-files/MedicalFilesPage";
import WhatsAppPage from "../pages/whatsapp/WhatsappPage";
import RepresentativeVisitsPage from "../pages/representatives/RepresentativeVisitsPage";


export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
  path="/setup-clinic"
  element={<SetupClinicPage />}
/>

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<DashboardPage />}
          />

          <Route
            path="appointments"
            element={
              <ProtectedRoute permissions={["appointments_view"]}>
                <AppointmentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="patients"
            element={
              <ProtectedRoute permissions={["patients_basic"]}>
                <PatientsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="patients/:patientId"
            element={
              <ProtectedRoute permissions={["patients_basic"]}>
                <PatientProfilePage />
              </ProtectedRoute>
            }
          />

            <Route
            path="representatives"
            element={
              <ProtectedRoute permissions={["visits"]}>
                <RepresentativeVisitsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="patients/:patientId/visit/new"
            element={
              <ProtectedRoute permissions={["visits"]}>
                <NewVisitPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="queue"
            element={<Navigate to="/appointments" replace />}
          />

       <Route
  path="visits"
  element={
    <ProtectedRoute permissions={["visits", "medical_history"]}>
      <VisitsPage />
    </ProtectedRoute>
  }
/>

          <Route
            path="prescriptions"
            element={
              <ProtectedRoute permissions={["prescriptions"]}>
                <PrescriptionsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="drugs"
            element={
              <ProtectedRoute permissions={["drug_library"]}>
                <DrugLibraryPage />
              </ProtectedRoute>
            }
          />

        <Route
  path="medical-files"
  element={
    <ProtectedRoute permissions={["medical_files"]}>
      <MedicalFilesPage />
    </ProtectedRoute>
  }
/>

          <Route
            path="whatsapp"
            element={
              <ProtectedRoute permissions={["medical_files"]}>
                <WhatsAppPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="finance"
            element={
              <ProtectedRoute permissions={["finance"]}>
                <FinancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="reports"
            element={
              <ProtectedRoute permissions={["reports"]}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="staff"
            element={
              <ProtectedRoute permissions={["staff"]}>
                <StaffPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="settings"
            element={
              <ProtectedRoute permissions={["settings"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}