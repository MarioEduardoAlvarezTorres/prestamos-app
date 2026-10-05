"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

import {
  solicitarPrestamo as solicitarPrestamoService,
  responderSolicitud as responderSolicitudService,
  confirmarRecepcion as confirmarRecepcionService,
  registrarPago as registrarPagoService,
  verComprobante as verComprobanteService,
} from "../lib/prestamos";

import {
  crearGastoCompartido as crearGastoCompartidoService,
  responderGastoCompartido as responderGastoCompartidoService,
} from "../lib/gastos";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_active: boolean;
};

type Loan = {
  id: string;
  lender_id: string;
  borrower_id: string;
  amount: number;
  description: string | null;
  due_date: string | null;
  status:
  | "pending"
  | "active"
  | "payment_pending"
  | "completed"
  | "rejected"
  | "cancelled";
  created_at: string;
  updated_at: string;
};

type Payment = {
  id: string;
  loan_id: string;
  paid_by: string;
  amount: number;
  evidence_url: string | null;
  payer_confirmed: boolean;
  receiver_confirmed: boolean;
  created_at: string;
};

type SharedExpense = {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  total_amount: number;
  status: "pending" | "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

type SharedExpenseParticipant = {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  accepted: boolean;
  accepted_at: string | null;
  paid: boolean;
  created_at: string;
};

type ModalData = {
  title: string;
  message: string;
  type?: "success" | "error" | "info";
};
const supabase = createClient();

export default function Home() {

  // =========================
  // SESIÓN
  // =========================

  const [email, setEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // =========================
  // DATOS
  // =========================

  const [users, setUsers] = useState<Profile[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>([]);
  const [sharedParticipants, setSharedParticipants] = useState<
    SharedExpenseParticipant[]
  >([]);

  // =========================
  // NAVEGACIÓN
  // =========================

  const [activeTab, setActiveTab] = useState<
    "prestamos" | "gastos" | "historial"
  >("prestamos");

  // =========================
  // PRÉSTAMOS
  // =========================

  const [selectedUser, setSelectedUser] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  // =========================
  // PAGOS DE PRÉSTAMOS
  // =========================

  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);

  // =========================
  // GASTOS COMPARTIDOS
  // =========================

  const [showSharedExpenseForm, setShowSharedExpenseForm] = useState(false);

  const [sharedExpenseTitle, setSharedExpenseTitle] = useState("");
  const [sharedExpenseDescription, setSharedExpenseDescription] =
    useState("");
  const [sharedExpenseTotal, setSharedExpenseTotal] = useState("");

  const [sharedExpenseUsers, setSharedExpenseUsers] = useState<string[]>([]);

  const [sharedExpenseMode, setSharedExpenseMode] = useState<
    "equal" | "custom"
  >("equal");

  const [sharedCustomAmounts, setSharedCustomAmounts] = useState<
    Record<string, string>
  >({});

  // =========================
  // ESTADOS GENERALES
  // =========================

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [paymentSending, setPaymentSending] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [responseLoading, setResponseLoading] = useState<string | null>(null);
  const [sharedExpenseLoading, setSharedExpenseLoading] = useState(false);

  const [modal, setModal] = useState<ModalData | null>(null);

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // =========================
  // HELPERS
  // =========================

  function mostrarModal(
    title: string,
    message: string,
    type: "success" | "error" | "info" = "info"
  ) {
    setModal({
      title,
      message,
      type,
    });
  }

  function cerrarModal() {
    setModal(null);
  }

  function formatearMonto(value: number | string) {
    const numero = Number(value || 0);

    return numero.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });
  }

  function formatearFecha(value: string | null) {
    if (!value) return "Sin fecha";

    return new Date(value).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function obtenerNombre(userId: string) {
    if (userId === currentUserId) {
      return "Tú";
    }

    const user = users.find((item) => item.id === userId);

    return user?.full_name || user?.email || "Usuario";
  }

  // =========================
  // CARGAR DATOS
  // =========================

  async function loadData() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setCurrentUserId(null);
        setEmail("");
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      setCurrentUserId(userId);
      setEmail(session.user.email || "");

      // -------------------------
      // USUARIOS
      // -------------------------

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, avatar_url, is_admin, is_active"
        )
        .eq("is_active", true)
        .neq("id", userId)
        .order("full_name", { ascending: true });

      if (profilesError) {
        console.error("Error cargando usuarios:", profilesError);
      } else {
        setUsers(profilesData || []);
      }

      // -------------------------
      // PRÉSTAMOS
      // -------------------------

      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("*")
        .or(`lender_id.eq.${userId},borrower_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (loansError) {
        console.error("Error cargando préstamos:", loansError);
      } else {
        setLoans(loansData || []);
      }

      // -------------------------
      // PAGOS
      // -------------------------

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("loan_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (paymentsError) {
        console.error("Error cargando pagos:", paymentsError);
      } else {
        setPayments(paymentsData || []);
      }

      // -------------------------
      // GASTOS COMPARTIDOS
      // -------------------------

      const { data: expensesData, error: expensesError } = await supabase
        .from("shared_expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (expensesError) {
        console.error(
          "Error cargando gastos compartidos:",
          expensesError
        );
      } else {
        setSharedExpenses(expensesData || []);
      }

      // -------------------------
      // PARTICIPANTES
      // -------------------------

      const { data: participantsData, error: participantsError } =
        await supabase
          .from("shared_expense_participants")
          .select("*");

      if (participantsError) {
        console.error(
          "Error cargando participantes:",
          participantsError
        );
      } else {
        setSharedParticipants(participantsData || []);
      }
    } catch (error) {
      console.error("Error general cargando datos:", error);
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // EFECTOS
  // =========================

  useEffect(() => {
    loadData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setCurrentUserId(session.user.id);
        setEmail(session.user.email || "");

        setTimeout(() => {
          loadData();
        }, 0);
      } else {
        setCurrentUserId(null);
        setEmail("");
        setLoans([]);
        setPayments([]);
        setUsers([]);
        setSharedExpenses([]);
        setSharedParticipants([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  // =========================
  // LOGIN
  // =========================

  async function loginWithGoogle() {
    try {
      setLoginLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback/`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo iniciar sesión",
        error?.message || "Ocurrió un error al iniciar sesión.",
        "error"
      );

      setLoginLoading(false);
    }
  }

  // =========================
  // LOGOUT
  // =========================

  async function cerrarSesion() {
    await supabase.auth.signOut();

    setCurrentUserId(null);
    setEmail("");
    setLoans([]);
    setPayments([]);
    setUsers([]);
    setSharedExpenses([]);
    setSharedParticipants([]);
  }

  // =========================
  // PWA
  // =========================

  async function instalarAplicacion() {
    if (!installPrompt) return;

    installPrompt.prompt();

    try {
      await installPrompt.userChoice;
    } catch {
      // No hacemos nada si el usuario cancela.
    }

    setInstallPrompt(null);
  }

  // ============================================================
  // PRÉSTAMOS
  // ============================================================

  async function solicitarPrestamo() {
    if (!selectedUser) {
      mostrarModal(
        "Falta una persona",
        "Selecciona a quién quieres prestar el dinero.",
        "error"
      );
      return;
    }

    const numero = Number(amount);

    if (!numero || numero <= 0) {
      mostrarModal(
        "Monto inválido",
        "Escribe un monto mayor a cero.",
        "error"
      );
      return;
    }

    if (selectedUser === currentUserId) {
      mostrarModal(
        "Persona inválida",
        "No puedes solicitarte un préstamo a ti mismo.",
        "error"
      );
      return;
    }

    try {
      setSending(true);

      await solicitarPrestamoService({
        borrowerId: selectedUser,
        amount: numero,
        description: description.trim(),
        dueDate: dueDate || null,
      });

      setSelectedUser("");
      setAmount("");
      setDescription("");
      setDueDate("");

      await loadData();

      mostrarModal(
        "Solicitud enviada",
        "La otra persona debe aceptar el préstamo para que quede activo.",
        "success"
      );
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo crear",
        error?.message || "Ocurrió un error creando el préstamo.",
        "error"
      );
    } finally {
      setSending(false);
    }
  }

  // =========================
  // RESPONDER SOLICITUD
  // =========================

  async function responderSolicitud(
    loanId: string,
    aceptar: boolean
  ) {
    try {
      setResponseLoading(loanId);

      await responderSolicitudService(loanId, aceptar);

      await loadData();

      mostrarModal(
        aceptar ? "Préstamo aceptado" : "Solicitud rechazada",
        aceptar
          ? "El préstamo ya está activo."
          : "La solicitud fue rechazada.",
        aceptar ? "success" : "info"
      );
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo responder",
        error?.message || "Ocurrió un error.",
        "error"
      );
    } finally {
      setResponseLoading(null);
    }
  }

  // ============================================================
  // PAGOS
  // ============================================================

  function abrirRegistroPago(loan: Loan) {
    setPaymentLoan(loan);
    setPaymentAmount(String(loan.amount));
    setPaymentFile(null);
  }

  function cerrarRegistroPago() {
    setPaymentLoan(null);
    setPaymentAmount("");
    setPaymentFile(null);
  }

  async function registrarPago() {
    if (!paymentLoan || !currentUserId) {
      return;
    }

    const numero = Number(paymentAmount);

    if (!numero || numero <= 0) {
      mostrarModal(
        "Monto inválido",
        "Escribe un monto válido.",
        "error"
      );
      return;
    }

    if (!paymentFile) {
      mostrarModal(
        "Falta comprobante",
        "Debes seleccionar una imagen o archivo como comprobante.",
        "error"
      );
      return;
    }

    try {
      setPaymentSending(true);

      await registrarPagoService({
        loanId: paymentLoan.id,
        userId: currentUserId,
        amount: numero,
        file: paymentFile,
      });

      cerrarRegistroPago();

      await loadData();

      mostrarModal(
        "Pago registrado",
        "El prestamista debe confirmar que recibió el pago.",
        "success"
      );
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo registrar",
        error?.message || "Ocurrió un error registrando el pago.",
        "error"
      );
    } finally {
      setPaymentSending(false);
    }
  }

  // =========================
  // VER COMPROBANTE
  // =========================

  async function verComprobante(path: string | null) {
    if (!path) {
      mostrarModal(
        "Sin comprobante",
        "Este pago no tiene comprobante.",
        "info"
      );
      return;
    }

    try {
      const url = await verComprobanteService(path);

      if (url) {
        window.open(url, "_blank");
      }
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo abrir",
        error?.message || "No se pudo abrir el comprobante.",
        "error"
      );
    }
  }

  // =========================
  // CONFIRMAR RECEPCIÓN
  // =========================

  async function confirmarRecepcion(loanId: string) {
    try {
      setResponseLoading(loanId);

      await confirmarRecepcionService(loanId);

      await loadData();

      mostrarModal(
        "Pago confirmado",
        "El préstamo quedó completado.",
        "success"
      );
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo confirmar",
        error?.message || "Ocurrió un error confirmando el pago.",
        "error"
      );
    } finally {
      setResponseLoading(null);
    }
  }

  // ============================================================
  // GASTOS COMPARTIDOS
  // ============================================================

  function toggleSharedExpenseUser(userId: string) {
    setSharedExpenseUsers((current) => {
      if (current.includes(userId)) {
        const next = current.filter((id) => id !== userId);

        setSharedCustomAmounts((amounts) => {
          const copy = { ...amounts };
          delete copy[userId];
          return copy;
        });

        return next;
      }

      if (current.length >= 3) {
        mostrarModal(
          "Máximo de personas",
          "Puedes seleccionar hasta 3 personas además de ti.",
          "info"
        );

        return current;
      }

      return [...current, userId];
    });
  }

  function obtenerCantidadCompartida(userId: string) {
    const total = Number(sharedExpenseTotal || 0);

    if (sharedExpenseMode === "custom") {
      return Number(sharedCustomAmounts[userId] || 0);
    }

    const cantidadPersonas = sharedExpenseUsers.length + 1;

    if (!total || cantidadPersonas <= 0) {
      return 0;
    }

    return Math.round((total / cantidadPersonas) * 100) / 100;
  }

  function obtenerCantidadDelCreador() {
    const total = Number(sharedExpenseTotal || 0);

    if (sharedExpenseMode === "equal") {
      const cantidadPersonas = sharedExpenseUsers.length + 1;

      if (!total || cantidadPersonas <= 0) {
        return 0;
      }

      return Math.round((total / cantidadPersonas) * 100) / 100;
    }

    const sumaOtros = sharedExpenseUsers.reduce(
      (sum, userId) =>
        sum + Number(sharedCustomAmounts[userId] || 0),
      0
    );

    return Math.round((total - sumaOtros) * 100) / 100;
  }

  async function crearGastoCompartido() {
    const total = Number(sharedExpenseTotal);

    if (!sharedExpenseTitle.trim()) {
      mostrarModal(
        "Falta el nombre",
        "Escribe qué gasto estás compartiendo.",
        "error"
      );
      return;
    }

    if (!total || total <= 0) {
      mostrarModal(
        "Monto inválido",
        "El total debe ser mayor a cero.",
        "error"
      );
      return;
    }

    if (sharedExpenseUsers.length === 0) {
      mostrarModal(
        "Faltan participantes",
        "Selecciona al menos una persona.",
        "error"
      );
      return;
    }

    if (sharedExpenseMode === "custom") {
      const sumaOtros = sharedExpenseUsers.reduce(
        (sum, userId) =>
          sum + Number(sharedCustomAmounts[userId] || 0),
        0
      );

      if (sumaOtros > total) {
        mostrarModal(
          "Montos inválidos",
          "La suma de las cantidades de los participantes no puede superar el total.",
          "error"
        );
        return;
      }

      const cantidadesInvalidas = sharedExpenseUsers.some(
        (userId) => Number(sharedCustomAmounts[userId] || 0) <= 0
      );

      if (cantidadesInvalidas) {
        mostrarModal(
          "Faltan cantidades",
          "Escribe cuánto debe pagar cada participante.",
          "error"
        );
        return;
      }
    }

    try {
      setSharedExpenseLoading(true);

      const participants = sharedExpenseUsers.map((userId) => ({
        user_id: userId,
        amount: obtenerCantidadCompartida(userId),
      }));

      await crearGastoCompartidoService({
        title: sharedExpenseTitle.trim(),
        description:
          sharedExpenseDescription.trim() || null,
        totalAmount: total,
        participants,
      });

      setSharedExpenseTitle("");
      setSharedExpenseDescription("");
      setSharedExpenseTotal("");
      setSharedExpenseUsers([]);
      setSharedExpenseMode("equal");
      setSharedCustomAmounts({});
      setShowSharedExpenseForm(false);

      await loadData();

      mostrarModal(
        "Gasto creado",
        "Las personas seleccionadas recibieron la solicitud.",
        "success"
      );
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo crear",
        error?.message || "Ocurrió un error creando el gasto.",
        "error"
      );
    } finally {
      setSharedExpenseLoading(false);
    }
  }

  // =========================
  // RESPONDER GASTO
  // =========================

  async function responderGastoCompartido(
    expenseId: string,
    aceptar: boolean
  ) {
    try {
      setResponseLoading(expenseId);

      await responderGastoCompartidoService(
        expenseId,
        aceptar
      );

      await loadData();

      mostrarModal(
        aceptar ? "Gasto aceptado" : "Gasto rechazado",
        aceptar
          ? "Aceptaste tu parte del gasto."
          : "Rechazaste participar en el gasto.",
        aceptar ? "success" : "info"
      );
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo responder",
        error?.message || "Ocurrió un error.",
        "error"
      );
    } finally {
      setResponseLoading(null);
    }
  }

  // ============================================================
  // DATOS DERIVADOS
  // ============================================================

  const misPrestamos = loans.filter(
    (loan) =>
      (loan.status === "active" ||
        loan.status === "payment_pending") &&
      (loan.lender_id === currentUserId ||
        loan.borrower_id === currentUserId)
  );

  const solicitudesPendientes = loans.filter(
    (loan) =>
      loan.status === "pending" &&
      loan.lender_id === currentUserId
  );

  const pagosPendientes = loans.filter(
    (loan) =>
      loan.status === "payment_pending" &&
      loan.lender_id === currentUserId
  );

  const historialPrestamos = loans.filter(
    (loan) =>
      loan.status === "completed" ||
      loan.status === "rejected" ||
      loan.status === "cancelled"
  );

  const gastosPendientes = sharedExpenses.filter((expense) => {
    if (!currentUserId) return false;

    return sharedParticipants.some(
      (participant) =>
        participant.expense_id === expense.id &&
        participant.user_id === currentUserId &&
        participant.accepted === false
    );
  });

  const misGastosCompartidos = sharedExpenses.filter((expense) => {
    if (!currentUserId) return false;

    return (
      expense.created_by === currentUserId ||
      sharedParticipants.some(
        (participant) =>
          participant.expense_id === expense.id &&
          participant.user_id === currentUserId
      )
    );
  });

  const historialGastos = sharedExpenses.filter(
    (expense) =>
      expense.status === "completed" ||
      expense.status === "cancelled"
  );

  // ============================================================
  // ESTADO DE CARGA
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-3xl mb-3">💸</div>
          <p className="text-slate-600">
            Cargando...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // LOGIN
  // ============================================================

  if (!currentUserId) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-5">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-7">
          <div className="text-center">
            <div className="text-5xl mb-4">💸</div>

            <h1 className="text-2xl font-bold text-slate-900">
              Préstamos
            </h1>

            <p className="text-slate-500 mt-2">
              Administra préstamos y gastos compartidos
              entre tu grupo.
            </p>
          </div>

          <button
            onClick={loginWithGoogle}
            disabled={loginLoading}
            className="w-full mt-7 rounded-2xl bg-slate-900 text-white py-4 font-semibold disabled:opacity-50"
          >
            {loginLoading
              ? "Conectando..."
              : "Continuar con Google"}
          </button>
        </div>
      </main>
    );
  }

  // ============================================================
  // APP
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      {/* HEADER */}

      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">
              Conectado como
            </p>

            <p className="font-semibold text-slate-900 truncate max-w-[220px]">
              {email}
            </p>
          </div>

          <button
            onClick={cerrarSesion}
            className="text-sm text-red-600 font-semibold"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pt-5">
        {/* INSTALAR */}

        {installPrompt && (
          <button
            onClick={instalarAplicacion}
            className="w-full mb-5 rounded-2xl bg-indigo-600 text-white py-3 font-semibold"
          >
            📱 Instalar aplicación
          </button>
        )}

        {/* =====================================================
            PESTAÑA PRÉSTAMOS
        ===================================================== */}

        {activeTab === "prestamos" && (
          <div className="space-y-5">
            {/* SOLICITAR PRÉSTAMO */}

            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Solicitar préstamo
                </h2>

                <p className="text-sm text-slate-700 mt-1">
                  La otra persona deberá aceptar.
                </p>
              </div>

              <div className="space-y-3">
                <select
                  value={selectedUser}
                  onChange={(event) =>
                    setSelectedUser(event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900"
                >
                  <option value="">
                    Selecciona una persona
                  </option>

                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Monto"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                />

                <input
                  type="text"
                  placeholder="Concepto (opcional)"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                />

                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900"
                />

                <button
                  onClick={solicitarPrestamo}
                  disabled={sending}
                  className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold disabled:opacity-50"
                >
                  {sending
                    ? "Enviando..."
                    : "Enviar solicitud"}
                </button>
              </div>
            </section>

            {/* SOLICITUDES PENDIENTES */}

            {solicitudesPendientes.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">
                  Solicitudes pendientes
                </h2>

                <div className="space-y-3">
                  {solicitudesPendientes.map((loan) => (
                    <div
                      key={loan.id}
                      className="bg-white rounded-3xl border border-amber-200 p-5 shadow-sm"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {obtenerNombre(
                              loan.borrower_id
                            )}
                          </p>

                          <p className="text-sm text-slate-700 mt-1">
                            {loan.description ||
                              "Préstamo"}
                          </p>
                        </div>

                        <p className="font-bold text-lg text-slate-900">
                          {formatearMonto(loan.amount)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={() =>
                            responderSolicitud(
                              loan.id,
                              true
                            )
                          }
                          disabled={
                            responseLoading === loan.id
                          }
                          className="rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
                        >
                          Aceptar
                        </button>

                        <button
                          onClick={() =>
                            responderSolicitud(
                              loan.id,
                              false
                            )
                          }
                          disabled={
                            responseLoading === loan.id
                          }
                          className="rounded-2xl bg-red-100 text-red-700 py-3 font-semibold disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* MIS PRÉSTAMOS */}

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Préstamos activos
              </h2>

              {misPrestamos.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center">
                  <p className="text-slate-700">
                    No tienes préstamos activos.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {misPrestamos.map((loan) => {
                    const soyPrestamista =
                      loan.lender_id === currentUserId;

                    const soyDeudor =
                      loan.borrower_id === currentUserId;

                    const payment = payments.find(
                      (item) => item.loan_id === loan.id
                    );

                    return (
                      <div
                        key={loan.id}
                        className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {soyPrestamista
                                ? `Le prestaste a ${obtenerNombre(
                                  loan.borrower_id
                                )}`
                                : `Te prestó ${obtenerNombre(
                                  loan.lender_id
                                )}`}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              {loan.description ||
                                "Préstamo"}
                            </p>
                          </div>

                          <p className="font-bold text-lg whitespace-nowrap text-slate-900">
                            {formatearMonto(loan.amount)}
                          </p>
                        </div>

                        <div className="mt-4 text-sm text-slate-700">
                          Fecha límite:{" "}
                          {formatearFecha(loan.due_date)}
                        </div>

                        <div className="mt-4">
                          {loan.status === "active" &&
                            soyDeudor && (
                              <button
                                onClick={() =>
                                  abrirRegistroPago(loan)
                                }
                                className="w-full rounded-2xl bg-slate-900 text-white py-3 font-semibold"
                              >
                                Registrar pago
                              </button>
                            )}

                          {loan.status ===
                            "payment_pending" &&
                            soyPrestamista && (
                              <div className="space-y-2">
                                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                                  El deudor registró un
                                  pago. Revisa el
                                  comprobante y confirma
                                  si lo recibiste.
                                </div>

                                {payment?.evidence_url && (
                                  <button
                                    onClick={() =>
                                      verComprobante(
                                        payment.evidence_url
                                      )
                                    }
                                    className="w-full rounded-2xl bg-slate-100 text-slate-800 py-3 font-semibold"
                                  >
                                    Ver comprobante
                                  </button>
                                )}

                                <button
                                  onClick={() =>
                                    confirmarRecepcion(
                                      loan.id
                                    )
                                  }
                                  disabled={
                                    responseLoading ===
                                    loan.id
                                  }
                                  className="w-full rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
                                >
                                  {responseLoading ===
                                    loan.id
                                    ? "Confirmando..."
                                    : "Confirmar recepción"}
                                </button>
                              </div>
                            )}

                          {loan.status === "payment_pending" &&
                            soyDeudor && (
                              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                                Pago enviado. Esperando
                                confirmación del
                                prestamista.
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* PAGOS PENDIENTES */}

            {pagosPendientes.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">
                  Pagos por confirmar
                </h2>

                <div className="space-y-3">
                  {pagosPendientes.map((loan) => {
                    const payment = payments.find(
                      (item) => item.loan_id === loan.id
                    );

                    return (
                      <div
                        key={loan.id}
                        className="bg-white rounded-3xl border border-amber-200 p-5"
                      >
                        <p className="font-semibold text-slate-900">
                          {obtenerNombre(loan.borrower_id)}
                        </p>

                        <p className="text-sm text-slate-700 mt-1">
                          Pagó{" "}
                          {formatearMonto(
                            payment?.amount ||
                            loan.amount
                          )}
                        </p>

                        {payment?.evidence_url && (
                          <button
                            onClick={() =>
                              verComprobante(
                                payment.evidence_url
                              )
                            }
                            className="w-full mt-3 rounded-2xl bg-slate-100 text-slate-800 py-3 font-semibold"
                          >
                            Ver comprobante
                          </button>
                        )}

                        <button
                          onClick={() =>
                            confirmarRecepcion(loan.id)
                          }
                          disabled={
                            responseLoading === loan.id
                          }
                          className="w-full mt-2 rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
                        >
                          {responseLoading === loan.id
                            ? "Confirmando..."
                            : "Confirmar recepción"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* =====================================================
            PESTAÑA GASTOS
        ===================================================== */}

        {activeTab === "gastos" && (
          <div className="space-y-5">
            {/* CREAR GASTO */}

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Gastos compartidos
                  </h2>

                  <p className="text-sm text-slate-700 mt-1">
                    Divide una comida, salida o compra
                    entre varias personas.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowSharedExpenseForm(
                      (value) => !value
                    )
                  }
                  className="rounded-2xl bg-slate-900 text-white px-4 py-3 font-semibold"
                >
                  {showSharedExpenseForm
                    ? "Cerrar"
                    : "Nuevo"}
                </button>
              </div>

              {showSharedExpenseForm && (
                <div className="mt-5 space-y-4">
                  <input
                    type="text"
                    placeholder="¿Qué pagaste?"
                    value={sharedExpenseTitle}
                    onChange={(event) =>
                      setSharedExpenseTitle(
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                  />

                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Total"
                    value={sharedExpenseTotal}
                    onChange={(event) =>
                      setSharedExpenseTotal(
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                  />

                  <textarea
                    placeholder="Descripción (opcional)"
                    value={sharedExpenseDescription}
                    onChange={(event) =>
                      setSharedExpenseDescription(
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500 min-h-24"
                  />

                  <div>
                    <p className="font-semibold text-slate-900 mb-2">
                      Participantes
                    </p>

                    <div className="space-y-2">
                      {users.map((user) => {
                        const selected =
                          sharedExpenseUsers.includes(
                            user.id
                          );

                        return (
                          <button
                            key={user.id}
                            onClick={() =>
                              toggleSharedExpenseUser(
                                user.id
                              )
                            }
                            className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left text-slate-900 ${selected
                              ? "border-slate-900 bg-slate-100"
                              : "border-slate-200 bg-white"
                              }`}
                          >
                            <span className="text-slate-900">
                              {user.full_name ||
                                user.email}
                            </span>

                            <span className="text-slate-900">
                              {selected ? "✓" : "○"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {sharedExpenseUsers.length > 0 && (
                    <>
                      <div>
                        <p className="font-semibold text-slate-900 mb-2">
                          ¿Cómo dividir?
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              setSharedExpenseMode(
                                "equal"
                              )
                            }
                            className={`rounded-2xl py-3 font-semibold ${sharedExpenseMode ===
                              "equal"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            Partes iguales
                          </button>

                          <button
                            onClick={() =>
                              setSharedExpenseMode(
                                "custom"
                              )
                            }
                            className={`rounded-2xl py-3 font-semibold ${sharedExpenseMode ===
                              "custom"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            Cantidades
                          </button>
                        </div>
                      </div>

                      {sharedExpenseMode ===
                        "custom" && (
                          <div className="space-y-2">
                            {sharedExpenseUsers.map(
                              (userId) => (
                                <div
                                  key={userId}
                                  className="flex items-center gap-2"
                                >
                                  <div className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-slate-900">
                                    {obtenerNombre(
                                      userId
                                    )}
                                  </div>

                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="$"
                                    value={
                                      sharedCustomAmounts[
                                      userId
                                      ] || ""
                                    }
                                    onChange={(event) =>
                                      setSharedCustomAmounts(
                                        (current) => ({
                                          ...current,
                                          [userId]:
                                            event.target
                                              .value,
                                        })
                                      )
                                    }
                                    className="w-28 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                                  />
                                </div>
                              )
                            )}
                          </div>
                        )}

                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-sm text-slate-700">
                          Tu parte
                        </p>

                        <p className="text-xl font-bold text-slate-900">
                          {formatearMonto(
                            obtenerCantidadDelCreador()
                          )}
                        </p>

                        {sharedExpenseMode ===
                          "custom" && (
                            <p className="text-xs text-slate-700 mt-1">
                              El restante del total queda
                              asignado a ti.
                            </p>
                          )}
                      </div>

                      <button
                        onClick={crearGastoCompartido}
                        disabled={
                          sharedExpenseLoading
                        }
                        className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold disabled:opacity-50"
                      >
                        {sharedExpenseLoading
                          ? "Creando..."
                          : "Crear gasto compartido"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* SOLICITUDES DE GASTOS */}

            {gastosPendientes.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">
                  Solicitudes de gastos
                </h2>

                <div className="space-y-3">
                  {gastosPendientes.map((expense) => {
                    const participant =
                      sharedParticipants.find(
                        (item) =>
                          item.expense_id ===
                          expense.id &&
                          item.user_id ===
                          currentUserId
                      );

                    return (
                      <div
                        key={expense.id}
                        className="bg-white rounded-3xl border border-amber-200 p-5"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {expense.title}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              Pagado por{" "}
                              {obtenerNombre(
                                expense.created_by
                              )}
                            </p>
                          </div>

                          <p className="font-bold text-slate-900">
                            {formatearMonto(
                              participant?.amount || 0
                            )}
                          </p>
                        </div>

                        {expense.description && (
                          <p className="text-sm text-slate-700 mt-3">
                            {expense.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <button
                            onClick={() =>
                              responderGastoCompartido(
                                expense.id,
                                true
                              )
                            }
                            disabled={
                              responseLoading ===
                              expense.id
                            }
                            className="rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
                          >
                            Aceptar
                          </button>

                          <button
                            onClick={() =>
                              responderGastoCompartido(
                                expense.id,
                                false
                              )
                            }
                            disabled={
                              responseLoading ===
                              expense.id
                            }
                            className="rounded-2xl bg-red-100 text-red-700 py-3 font-semibold disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* MIS GASTOS */}

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Mis gastos compartidos
              </h2>

              {misGastosCompartidos.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center">
                  <p className="text-slate-700">
                    Todavía no tienes gastos compartidos.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {misGastosCompartidos.map(
                    (expense) => {
                      const participant =
                        sharedParticipants.find(
                          (item) =>
                            item.expense_id ===
                            expense.id &&
                            item.user_id ===
                            currentUserId
                        );

                      return (
                        <div
                          key={expense.id}
                          className="bg-white rounded-3xl border border-slate-200 p-5"
                        >
                          <div className="flex justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {expense.title}
                              </p>

                              <p className="text-sm text-slate-700 mt-1">
                                Total:{" "}
                                {formatearMonto(
                                  expense.total_amount
                                )}
                              </p>
                            </div>

                            {participant && (
                              <p className="font-bold text-slate-900">
                                {formatearMonto(
                                  participant.amount
                                )}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 text-sm">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 ${participant?.accepted
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                                }`}
                            >
                              {participant?.accepted
                                ? "Aceptado"
                                : "Pendiente"}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* =====================================================
            PESTAÑA HISTORIAL
        ===================================================== */}

        {activeTab === "historial" && (
          <div className="space-y-6">
            {/* HISTORIAL PRÉSTAMOS */}

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                Historial de préstamos
              </h2>

              {historialPrestamos.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center">
                  <p className="text-slate-700">
                    No hay préstamos en el historial.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historialPrestamos.map((loan) => (
                    <div
                      key={loan.id}
                      className="bg-white rounded-3xl border border-slate-200 p-5"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {loan.lender_id ===
                              currentUserId
                              ? `Le prestaste a ${obtenerNombre(
                                loan.borrower_id
                              )}`
                              : `Te prestó ${obtenerNombre(
                                loan.lender_id
                              )}`}
                          </p>

                          <p className="text-sm text-slate-700 mt-1">
                            {loan.description ||
                              "Préstamo"}
                          </p>
                        </div>

                        <p className="font-bold text-slate-900">
                          {formatearMonto(loan.amount)}
                        </p>
                      </div>

                      <div className="mt-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm ${loan.status ===
                            "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : loan.status ===
                              "rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-700"
                            }`}
                        >
                          {loan.status ===
                            "completed"
                            ? "Completado"
                            : loan.status ===
                              "rejected"
                              ? "Rechazado"
                              : "Cancelado"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* HISTORIAL GASTOS */}

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                Historial de gastos
              </h2>

              {historialGastos.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center">
                  <p className="text-slate-700">
                    No hay gastos terminados.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historialGastos.map((expense) => {
                    const participant =
                      sharedParticipants.find(
                        (item) =>
                          item.expense_id ===
                          expense.id &&
                          item.user_id ===
                          currentUserId
                      );

                    return (
                      <div
                        key={expense.id}
                        className="bg-white rounded-3xl border border-slate-200 p-5"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {expense.title}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              Total{" "}
                              {formatearMonto(
                                expense.total_amount
                              )}
                            </p>
                          </div>

                          {participant && (
                            <p className="font-bold text-slate-900">
                              {formatearMonto(
                                participant.amount
                              )}
                            </p>
                          )}
                        </div>

                        <div className="mt-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-sm ${expense.status ===
                              "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                              }`}
                          >
                            {expense.status ===
                              "completed"
                              ? "Completado"
                              : "Cancelado"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* =====================================================
          NAVEGACIÓN INFERIOR
      ===================================================== */}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
        <div className="max-w-xl mx-auto grid grid-cols-3">
          <button
            onClick={() =>
              setActiveTab("prestamos")
            }
            className={`py-4 text-sm font-semibold ${activeTab === "prestamos"
              ? "text-slate-900"
              : "text-slate-500"
              }`}
          >
            <div className="text-xl">💸</div>
            Préstamos
          </button>

          <button
            onClick={() =>
              setActiveTab("gastos")
            }
            className={`py-4 text-sm font-semibold ${activeTab === "gastos"
              ? "text-slate-900"
              : "text-slate-500"
              }`}
          >
            <div className="text-xl">🍽️</div>
            Gastos
          </button>

          <button
            onClick={() =>
              setActiveTab("historial")
            }
            className={`py-4 text-sm font-semibold ${activeTab === "historial"
              ? "text-slate-900"
              : "text-slate-500"
              }`}
          >
            <div className="text-xl">📋</div>
            Historial
          </button>
        </div>
      </nav>

      {/* =====================================================
          MODAL GENERAL
      ===================================================== */}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-5">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <div
              className={`text-3xl mb-3 ${modal.type === "success"
                ? "text-emerald-600"
                : modal.type === "error"
                  ? "text-red-600"
                  : "text-slate-700"
                }`}
            >
              {modal.type === "success"
                ? "✓"
                : modal.type === "error"
                  ? "!"
                  : "i"}
            </div>

            <h3 className="text-xl font-bold text-slate-900">
              {modal.title}
            </h3>

            <p className="text-slate-700 mt-2">
              {modal.message}
            </p>

            <button
              onClick={cerrarModal}
              className="w-full mt-5 rounded-2xl bg-slate-900 text-white py-3 font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          MODAL REGISTRAR PAGO
      ===================================================== */}

      {paymentLoan && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-5">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900">
              Registrar pago
            </h3>

            <p className="text-sm text-slate-700 mt-1">
              {formatearMonto(paymentLoan.amount)}
            </p>

            <div className="space-y-3 mt-5">
              <input
                type="number"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(event) =>
                  setPaymentAmount(event.target.value)
                }
                placeholder="Monto pagado"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
              />

              <label className="block">
                <span className="block text-sm font-semibold text-slate-700 mb-2">
                  Comprobante
                </span>

                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) =>
                    setPaymentFile(
                      event.target.files?.[0] || null
                    )
                  }
                  className="w-full text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-6">
              <button
                onClick={cerrarRegistroPago}
                disabled={paymentSending}
                className="rounded-2xl bg-slate-100 text-slate-700 py-3 font-semibold"
              >
                Cancelar
              </button>

              <button
                onClick={registrarPago}
                disabled={paymentSending}
                className="rounded-2xl bg-slate-900 text-white py-3 font-semibold disabled:opacity-50"
              >
                {paymentSending
                  ? "Guardando..."
                  : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}