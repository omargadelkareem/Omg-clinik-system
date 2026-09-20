import {
  BrowserRouter,
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
import QueuePage from "../pages/queue/QueuePage";
import PlaceholderPage from "../pages/PlaceholderPage";
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
            element={<AppointmentsPage />}
          />

          <Route
            path="patients"
            element={<PatientsPage />}
          />

          <Route
            path="patients/:patientId"
            element={<PatientProfilePage />}
          />

          <Route
            path="patients/:patientId/visit/new"
            element={<NewVisitPage />}
          />

          <Route
            path="queue"
            element={<QueuePage />}
          />

       <Route
  path="visits"
  element={<VisitsPage />}
/>

          <Route
            path="prescriptions"
            element={<PrescriptionsPage />}
          />

          <Route
            path="drugs"
            element={<DrugLibraryPage />}
          />

        <Route
  path="medical-files"
  element={<MedicalFilesPage />}
/>

          <Route
            path="whatsapp"
            element={<WhatsAppPage />}
          />

          <Route
            path="finance"
            element={<FinancePage />}
          />

          <Route
            path="reports"
            element={<ReportsPage />}
          />

          <Route
            path="staff"
            element={<StaffPage />}
          />

          <Route
            path="settings"
            element={<SettingsPage />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}