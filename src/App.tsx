import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AccountingProvider } from "@/store/AccountingContext";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import PlanCuentas from "./pages/PlanCuentas";
import LibroDiario from "./pages/LibroDiario";
import VentasPage from "./pages/VentasPage";
import ProduccionPage from "./pages/ProduccionPage";
import StockPage from "./pages/StockPage";
import InsumosPage from "./pages/InsumosPage";
import RecetasPage from "./pages/RecetasPage";
import FlujoCajaPage from "./pages/FlujoCajaPage";
import LibroMayorPage from "./pages/LibroMayorPage";
import ReportesPage from "./pages/ReportesPage";
import CierreMensualPage from "./pages/CierreMensualPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";
import EstadoResultadosPage from "./pages/EstadoResultadosPage";
import BalanceGeneralPage from "./pages/BalanceGeneralPage";
import ImpresionMensualPage from "./pages/ImpresionMensualPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AccountingProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/plan-cuentas" element={<PlanCuentas />} />
              <Route path="/libro-diario" element={<LibroDiario />} />
              <Route path="/insumos" element={<InsumosPage />} />
              <Route path="/recetas" element={<RecetasPage />} />
              <Route path="/ventas" element={<VentasPage />} />
              <Route path="/produccion" element={<ProduccionPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/flujo-caja" element={<FlujoCajaPage />} />
              <Route path="/libro-mayor" element={<LibroMayorPage />} />
              <Route path="/reportes" element={<ReportesPage />} />
              <Route path="/cierre-mensual" element={<CierreMensualPage />} />
              <Route path="/estado-resultados" element={<EstadoResultadosPage />} />
              <Route path="/balance-general" element={<BalanceGeneralPage />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
              <Route path="/impresion-mensual" element={<ImpresionMensualPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AccountingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
