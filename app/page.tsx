"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase";

import {
  registrarPrestamo as registrarPrestamoService,
  responderSolicitud as responderSolicitudService,
  confirmarRecepcion as confirmarRecepcionService,
  registrarPago as registrarPagoService,
  verComprobante as verComprobanteService,
} from "../lib/prestamos";

import {
  crearGastoCompartido as crearGastoCompartidoService,
  responderGastoCompartido as responderGastoCompartidoService,
  registrarPagoGastoCompartido as registrarPagoGastoCompartidoService,
  confirmarPagoGastoCompartido as confirmarPagoGastoCompartidoService,
  verComprobanteGastoCompartido as verComprobanteGastoCompartidoService,
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
  status: string;
  created_at: string;
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
  status: string;
  created_at: string;
};

type SharedExpenseParticipant = {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  accepted: boolean;
  accepted_at: string | null;
  paid: boolean;
  payment_amount?: number | null;
  payment_evidence_url?: string | null;
  payment_at?: string | null;
  payment_confirmed?: boolean;
  payment_confirmed_at?: string | null;
  created_at: string;
};

type ModalData = {
  title: string;
  message: string;
  type?: "success" | "error" | "info";
};

function money(value: number | null | undefined) {
  return `$${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value: string | null | undefined) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function Home() {
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  const [users, setUsers] = useState<Profile[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>([]);
  const [sharedParticipants, setSharedParticipants] = useState<
    SharedExpenseParticipant[]
  >([]);

  const [activeTab, setActiveTab] = useState<
    "prestamos" | "gastos" | "historial"
  >("prestamos");

  const [loading, setLoading] = useState(true);
  const [responseLoading, setResponseLoading] = useState(false);

  const [selectedUser, setSelectedUser] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);

  const [sharedExpenseTitle, setSharedExpenseTitle] = useState("");
  const [sharedExpenseDescription, setSharedExpenseDescription] =
    useState("");
  const [sharedExpenseTotal, setSharedExpenseTotal] = useState("");
  const [sharedExpenseUsers, setSharedExpenseUsers] = useState<string[]>([]);
  const [sharedExpenseMode, setSharedExpenseMode] = useState<
    "equal" | "custom"
  >("equal");
  const [sharedExpenseAmounts, setSharedExpenseAmounts] = useState<
    Record<string, string>
  >({});

  const [sharedPaymentParticipant, setSharedPaymentParticipant] =
    useState<SharedExpenseParticipant | null>(null);
  const [sharedPaymentAmount, setSharedPaymentAmount] = useState("");
  const [sharedPaymentFile, setSharedPaymentFile] = useState<File | null>(
    null
  );

  const [modal, setModal] = useState<ModalData | null>(null);

  function mostrarModal(
    title: string,
    message: string,
    type: "success" | "error" | "info" = "info"
  ) {
    setModal({ title, message, type });
  }

  async function loadData() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(user.id);

      const [
        profileResult,
        usersResult,
        loansResult,
        paymentsResult,
        expensesResult,
        participantsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, email, avatar_url, is_admin, is_active"
          )
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select(
            "id, full_name, email, avatar_url, is_admin, is_active"
          )
          .eq("is_active", true)
          .neq("id", user.id)
          .order("full_name"),

        supabase
          .from("loans")
          .select("*")
          .or(`lender_id.eq.${user.id},borrower_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),

        supabase
          .from("loan_payments")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("shared_expenses")
          .select("*")
          .or(`created_by.eq.${user.id}`)
          .order("created_at", { ascending: false }),

        supabase
          .from("shared_expense_participants")
          .select("*")
          .order("created_at", { ascending: true }),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (usersResult.error) throw usersResult.error;
      if (loansResult.error) throw loansResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (participantsResult.error) throw participantsResult.error;

      setCurrentUser(profileResult.data || null);
      setUsers(usersResult.data || []);
      setLoans(loansResult.data || []);
      setPayments(paymentsResult.data || []);

      const expenses = expensesResult.data || [];
      const participants = participantsResult.data || [];

      const participantExpenseIds = participants
        .filter((p) => p.user_id === user.id)
        .map((p) => p.expense_id);

      const ownExpenses = expenses.filter(
        (expense) =>
          expense.created_by === user.id ||
          participantExpenseIds.includes(expense.id)
      );

      setSharedExpenses(ownExpenses);
      setSharedParticipants(participants);
    } catch (error: any) {
      console.error(error);
      mostrarModal(
        "Error",
        error?.message || "No se pudieron cargar los datos.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function registrarPrestamo() {
    try {
      const numero = Number(loanAmount);

      if (!selectedUser) {
        mostrarModal("Falta una persona", "Selecciona a quién le prestaste.");
        return;
      }

      if (!numero || numero <= 0) {
        mostrarModal("Cantidad inválida", "Escribe una cantidad mayor que cero.");
        return;
      }

      await registrarPrestamoService({
        borrowerId: selectedUser,
        amount: numero,
        description: description.trim(),
        dueDate: dueDate || null,
      });

      setSelectedUser("");
      setLoanAmount("");
      setDescription("");
      setDueDate("");

      await loadData();

      mostrarModal(
        "Préstamo registrado",
        "La solicitud fue enviada a la persona seleccionada.",
        "success"
      );
    } catch (error: any) {
      console.error(error);
      mostrarModal(
        "No se pudo registrar",
        error?.message || "Ocurrió un error.",
        "error"
      );
    }
  }

  async function responderSolicitud(
    loanId: string,
    aceptar: boolean
  ) {
    try {
      setResponseLoading(true);

      await responderSolicitudService(loanId, aceptar);

      await loadData();

      mostrarModal(
        aceptar ? "Solicitud aceptada" : "Solicitud rechazada",
        aceptar
          ? "El préstamo ahora está activo."
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
      setResponseLoading(false);
    }
  }

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

  function seleccionarComprobante(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setPaymentFile(null);
      return;
    }

    const maxSize = 20 * 1024 * 1024;

    if (file.size > maxSize) {
      mostrarModal(
        "Archivo demasiado grande",
        "El comprobante debe pesar máximo 20 MB.",
        "error"
      );

      event.target.value = "";
      setPaymentFile(null);
      return;
    }

    setPaymentFile(file);
  }

  async function registrarPago() {
    try {
      if (!paymentLoan) return;

      if (!paymentFile) {
        mostrarModal(
          "Falta el comprobante",
          "Selecciona el comprobante del pago.",
          "error"
        );
        return;
      }

      const amount = Number(paymentAmount);

      if (!amount || amount <= 0) {
        mostrarModal(
          "Cantidad inválida",
          "Escribe una cantidad válida.",
          "error"
        );
        return;
      }

      await registrarPagoService({
        loanId: paymentLoan.id,
        userId: currentUserId,
        amount,
        file: paymentFile,
      });

      cerrarRegistroPago();
      await loadData();

      mostrarModal(
        "Pago registrado",
        "El comprobante fue enviado para confirmación.",
        "success"
      );
    } catch (error: any) {
      console.error(error);
      mostrarModal(
        "No se pudo registrar el pago",
        error?.message || "Ocurrió un error.",
        "error"
      );
    }
  }

  async function verComprobante(path: string) {
    try {
      const url = await verComprobanteService(path);

      const nuevaVentana = window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );

      if (!nuevaVentana) {
        window.location.assign(url);
      }
    } catch (error: any) {
      mostrarModal(
        "No se pudo abrir",
        error?.message || "No se pudo abrir el comprobante.",
        "error"
      );
    }
  }

  async function confirmarRecepcion(loanId: string) {
    try {
      await confirmarRecepcionService(loanId);
      await loadData();

      mostrarModal(
        "Pago confirmado",
        "La recepción del pago quedó confirmada.",
        "success"
      );
    } catch (error: any) {
      mostrarModal(
        "No se pudo confirmar",
        error?.message || "Ocurrió un error.",
        "error"
      );
    }
  }

  function toggleSharedExpenseUser(userId: string) {
    setSharedExpenseUsers((current) => {
      if (current.includes(userId)) {
        setSharedExpenseAmounts((amounts) => {
          const next = { ...amounts };
          delete next[userId];
          return next;
        });

        return current.filter((id) => id !== userId);
      }

      if (current.length >= 3) {
        mostrarModal(
          "Máximo alcanzado",
          "Puedes seleccionar hasta 3 personas además de ti."
        );
        return current;
      }

      return [...current, userId];
    });
  }

  function obtenerCantidadCompartida(userId: string) {
    const total = Number(sharedExpenseTotal);

    if (!total || sharedExpenseUsers.length === 0) return 0;

    if (sharedExpenseMode === "custom") {
      return Number(sharedExpenseAmounts[userId] || 0);
    }

    return total / (sharedExpenseUsers.length + 1);
  }

  function obtenerCantidadDelCreador() {
    const total = Number(sharedExpenseTotal);

    if (!total) return 0;

    const otros = sharedExpenseUsers.reduce(
      (sum, userId) => sum + obtenerCantidadCompartida(userId),
      0
    );

    return total - otros;
  }

  async function crearGastoCompartido() {
    try {
      const total = Number(sharedExpenseTotal);

      if (!sharedExpenseTitle.trim()) {
        mostrarModal("Falta el nombre", "Escribe el nombre del gasto.");
        return;
      }

      if (!total || total <= 0) {
        mostrarModal(
          "Total inválido",
          "El total debe ser mayor que cero."
        );
        return;
      }

      if (sharedExpenseUsers.length === 0) {
        mostrarModal(
          "Faltan participantes",
          "Selecciona al menos una persona."
        );
        return;
      }

      const participants = sharedExpenseUsers.map((userId) => ({
        user_id: userId,
        amount: Number(obtenerCantidadCompartida(userId).toFixed(2)),
      }));

      const participantTotal = participants.reduce(
        (sum, participant) => sum + participant.amount,
        0
      );

      if (participantTotal > total) {
        mostrarModal(
          "Cantidades inválidas",
          "La suma de las cantidades supera el total.",
          "error"
        );
        return;
      }

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
      setSharedExpenseAmounts({});
      setSharedExpenseMode("equal");

      await loadData();

      mostrarModal(
        "Gasto creado",
        "Las personas seleccionadas ahora tienen una solicitud pendiente.",
        "success"
      );
    } catch (error: any) {
      console.error(error);
      mostrarModal(
        "No se pudo crear",
        error?.message || "Ocurrió un error.",
        "error"
      );
    }
  }

  async function responderGastoCompartido(
    expenseId: string,
    aceptar: boolean
  ) {
    try {
      setResponseLoading(true);

      await responderGastoCompartidoService(
        expenseId,
        aceptar
      );

      await loadData();

      mostrarModal(
        aceptar ? "Gasto aceptado" : "Gasto rechazado",
        aceptar
          ? "Aceptaste participar en el gasto."
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
      setResponseLoading(false);
    }
  }

  function abrirPagoGasto(
    participant: SharedExpenseParticipant
  ) {
    setSharedPaymentParticipant(participant);
    setSharedPaymentAmount(String(participant.amount));
    setSharedPaymentFile(null);
  }

  function cerrarPagoGasto() {
    setSharedPaymentParticipant(null);
    setSharedPaymentAmount("");
    setSharedPaymentFile(null);
  }

  function seleccionarComprobanteGasto(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setSharedPaymentFile(null);
      return;
    }

    const maxSize = 20 * 1024 * 1024;

    if (file.size > maxSize) {
      mostrarModal(
        "Archivo demasiado grande",
        "El comprobante debe pesar máximo 20 MB.",
        "error"
      );

      event.target.value = "";
      setSharedPaymentFile(null);
      return;
    }

    setSharedPaymentFile(file);
  }

  async function registrarPagoGasto() {
    try {
      if (!sharedPaymentParticipant) return;

      if (!sharedPaymentFile) {
        mostrarModal(
          "Falta el comprobante",
          "Selecciona el comprobante del pago.",
          "error"
        );
        return;
      }

      const amount = Number(sharedPaymentAmount);

      if (!amount || amount <= 0) {
        mostrarModal(
          "Cantidad inválida",
          "Escribe una cantidad válida.",
          "error"
        );
        return;
      }

      await registrarPagoGastoCompartidoService({
        participantId: sharedPaymentParticipant.id,
        amount,
        file: sharedPaymentFile,
      });

      cerrarPagoGasto();
      await loadData();

      mostrarModal(
        "Pago enviado",
        "El creador del gasto debe confirmar la recepción.",
        "success"
      );
    } catch (error: any) {
      console.error(error);
      mostrarModal(
        "No se pudo registrar",
        error?.message || "Ocurrió un error.",
        "error"
      );
    }
  }

  async function confirmarPagoGasto(
    participantId: string
  ) {
    try {
      await confirmarPagoGastoCompartidoService(
        participantId
      );

      await loadData();

      mostrarModal(
        "Pago confirmado",
        "El pago quedó confirmado correctamente.",
        "success"
      );
    } catch (error: any) {
      console.error(error);
      mostrarModal(
        "No se pudo confirmar",
        error?.message || "Ocurrió un error.",
        "error"
      );
    }
  }

  async function verComprobanteGasto(path: string) {
    try {
      const url =
        await verComprobanteGastoCompartidoService(path);

      const nuevaVentana = window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );

      if (!nuevaVentana) {
        window.location.assign(url);
      }
    } catch (error: any) {
      mostrarModal(
        "No se pudo abrir",
        error?.message || "No se pudo abrir el comprobante.",
        "error"
      );
    }
  }

  const misPrestamos = useMemo(
    () =>
      loans.filter(
        (loan) =>
          loan.status === "active" &&
          (loan.lender_id === currentUserId ||
            loan.borrower_id === currentUserId)
      ),
    [loans, currentUserId]
  );

  const prestamosPorConfirmar = useMemo(
    () =>
      loans.filter(
        (loan) =>
          loan.status === "pending" &&
          loan.borrower_id === currentUserId
      ),
    [loans, currentUserId]
  );

  const pagosPendientes = useMemo(
    () =>
      loans.filter(
        (loan) =>
          loan.status === "payment_pending" &&
          loan.lender_id === currentUserId
      ),
    [loans, currentUserId]
  );

  const historialPrestamos = useMemo(
    () =>
      loans.filter(
        (loan) =>
          loan.status === "completed" ||
          loan.status === "rejected" ||
          loan.status === "cancelled"
      ),
    [loans]
  );

  const misGastos = useMemo(
    () =>
      sharedExpenses.filter((expense) =>
        sharedParticipants.some(
          (participant) =>
            participant.expense_id === expense.id &&
            (participant.user_id === currentUserId ||
              expense.created_by === currentUserId)
        )
      ),
    [sharedExpenses, sharedParticipants, currentUserId]
  );

  const gastosPorConfirmar = useMemo(
    () =>
      sharedExpenses.filter((expense) =>
        sharedParticipants.some(
          (participant) =>
            participant.expense_id === expense.id &&
            participant.user_id === currentUserId &&
            !participant.accepted &&
            expense.status === "pending"
        )
      ),
    [sharedExpenses, sharedParticipants, currentUserId]
  );

  const getProfile = (userId: string) =>
    userId === currentUserId
      ? currentUser
      : users.find((user) => user.id === userId);

  const getLoanPayment = (loanId: string) =>
    payments.find((payment) => payment.loan_id === loanId);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md text-center">
          <div className="text-lg font-semibold text-slate-900">
            Cargando...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-md px-4 pt-5">

        {/* HEADER */}
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Mis préstamos
            </p>

            <h1 className="text-2xl font-bold text-slate-900">
              {currentUser?.full_name ||
                currentUser?.email ||
                "Mi cuenta"}
            </h1>
          </div>

          <button
            type="button"
            onClick={cerrarSesion}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Salir
          </button>
        </header>

        {/* TABS */}
        <div className="mb-5 grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("prestamos")}
            className={`rounded-xl px-2 py-3 text-sm font-semibold ${
              activeTab === "prestamos"
                ? "bg-slate-900 text-white"
                : "text-slate-600"
            }`}
          >
            Préstamos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gastos")}
            className={`rounded-xl px-2 py-3 text-sm font-semibold ${
              activeTab === "gastos"
                ? "bg-slate-900 text-white"
                : "text-slate-600"
            }`}
          >
            Gastos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("historial")}
            className={`rounded-xl px-2 py-3 text-sm font-semibold ${
              activeTab === "historial"
                ? "bg-slate-900 text-white"
                : "text-slate-600"
            }`}
          >
            Historial
          </button>
        </div>

        {/* ================================================= */}
        {/* PRÉSTAMOS */}
        {/* ================================================= */}

        {activeTab === "prestamos" && (
          <div className="space-y-5">

            {/* CREAR PRÉSTAMO */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-lg font-bold text-slate-900">
                Registrar a quién le prestaste
              </h2>

              <p className="mb-4 text-sm text-slate-500">
                La persona deberá aceptar el préstamo.
              </p>

              <div className="space-y-3">
                <select
                  value={selectedUser}
                  onChange={(event) =>
                    setSelectedUser(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base"
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
                  min="0"
                  step="0.01"
                  value={loanAmount}
                  onChange={(event) =>
                    setLoanAmount(event.target.value)
                  }
                  placeholder="Cantidad"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
                />

                <input
                  type="text"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Descripción"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
                />

                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
                />

                <button
                  type="button"
                  onClick={registrarPrestamo}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white active:opacity-80"
                >
                  Registrar préstamo
                </button>
              </div>
            </section>

            {/* SOLICITUDES */}
            {prestamosPorConfirmar.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-slate-900">
                  Préstamos por aceptar
                </h2>

                <div className="space-y-3">
                  {prestamosPorConfirmar.map((loan) => {
                    const lender = getProfile(loan.lender_id);

                    return (
                      <article
                        key={loan.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                      >
                        <p className="font-bold text-slate-900">
                          {money(loan.amount)}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Te prestó{" "}
                          <strong>
                            {lender?.full_name || "Otra persona"}
                          </strong>
                        </p>

                        {loan.description && (
                          <p className="mt-2 text-sm text-slate-600">
                            {loan.description}
                          </p>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={responseLoading}
                            onClick={() =>
                              responderSolicitud(
                                loan.id,
                                false
                              )
                            }
                            className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-700"
                          >
                            Rechazar
                          </button>

                          <button
                            type="button"
                            disabled={responseLoading}
                            onClick={() =>
                              responderSolicitud(
                                loan.id,
                                true
                              )
                            }
                            className="rounded-xl bg-slate-900 px-3 py-3 font-semibold text-white"
                          >
                            Aceptar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ACTIVOS */}
            <section>
              <h2 className="mb-3 text-lg font-bold text-slate-900">
                Préstamos activos
              </h2>

              {misPrestamos.length === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">
                  No tienes préstamos activos.
                </div>
              ) : (
                <div className="space-y-3">
                  {misPrestamos.map((loan) => {
                    const otherUserId =
                      loan.lender_id === currentUserId
                        ? loan.borrower_id
                        : loan.lender_id;

                    const other = getProfile(otherUserId);
                    const isBorrower =
                      loan.borrower_id === currentUserId;

                    return (
                      <article
                        key={loan.id}
                        className="rounded-2xl bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xl font-bold text-slate-900">
                              {money(loan.amount)}
                            </p>

                            <p className="text-sm text-slate-600">
                              {isBorrower
                                ? `Le debes a ${
                                    other?.full_name ||
                                    "otra persona"
                                  }`
                                : `${
                                    other?.full_name ||
                                    "Otra persona"
                                  } te debe`}
                            </p>
                          </div>

                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Activo
                          </span>
                        </div>

                        {loan.description && (
                          <p className="mt-3 text-sm text-slate-600">
                            {loan.description}
                          </p>
                        )}

                        {loan.due_date && (
                          <p className="mt-2 text-xs text-slate-500">
                            Vence: {dateText(loan.due_date)}
                          </p>
                        )}

                        {isBorrower && (
                          <button
                            type="button"
                            onClick={() =>
                              abrirRegistroPago(loan)
                            }
                            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
                          >
                            Registrar pago
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* PAGOS POR CONFIRMAR */}
            {pagosPendientes.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-slate-900">
                  Pagos por confirmar
                </h2>

                <div className="space-y-3">
                  {pagosPendientes.map((loan) => {
                    const payment = getLoanPayment(loan.id);
                    const borrower = getProfile(
                      loan.borrower_id
                    );

                    return (
                      <article
                        key={loan.id}
                        className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-bold text-slate-900">
                              {money(
                                payment?.amount ||
                                  loan.amount
                              )}
                            </p>

                            <p className="text-sm text-slate-600">
                              Pago de{" "}
                              <strong>
                                {borrower?.full_name ||
                                  "Otra persona"}
                              </strong>
                            </p>
                          </div>

                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            Por confirmar
                          </span>
                        </div>

                        {payment?.created_at && (
                          <p className="mt-2 text-xs text-slate-500">
                            Enviado:{" "}
                            {dateText(payment.created_at)}
                          </p>
                        )}

                        {payment?.evidence_url && (
                          <button
                            type="button"
                            onClick={() =>
                              verComprobante(
                                payment.evidence_url!
                              )
                            }
                            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700"
                          >
                            Ver comprobante
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            confirmarRecepcion(loan.id)
                          }
                          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
                        >
                          Confirmar que recibí el pago
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ================================================= */}
        {/* GASTOS COMPARTIDOS */}
        {/* ================================================= */}

        {activeTab === "gastos" && (
          <div className="space-y-5">

            {/* CREAR GASTO */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-lg font-bold text-slate-900">
                Crear gasto compartido
              </h2>

              <p className="mb-4 text-sm text-slate-500">
                Selecciona quién debe pagarte.
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  value={sharedExpenseTitle}
                  onChange={(event) =>
                    setSharedExpenseTitle(
                      event.target.value
                    )
                  }
                  placeholder="Nombre del gasto"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
                />

                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={sharedExpenseTotal}
                  onChange={(event) =>
                    setSharedExpenseTotal(
                      event.target.value
                    )
                  }
                  placeholder="Total"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
                />

                <input
                  type="text"
                  value={sharedExpenseDescription}
                  onChange={(event) =>
                    setSharedExpenseDescription(
                      event.target.value
                    )
                  }
                  placeholder="Descripción opcional"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
                />

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    ¿Cómo dividir?
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSharedExpenseMode("equal")
                      }
                      className={`rounded-xl px-3 py-3 text-sm font-semibold ${
                        sharedExpenseMode === "equal"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      Partes iguales
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSharedExpenseMode("custom")
                      }
                      className={`rounded-xl px-3 py-3 text-sm font-semibold ${
                        sharedExpenseMode === "custom"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      Cantidades
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    Personas que deben pagar
                  </p>

                  <div className="space-y-2">
                    {users.map((user) => {
                      const selected =
                        sharedExpenseUsers.includes(user.id);

                      return (
                        <div
                          key={user.id}
                          className="flex items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              toggleSharedExpenseUser(
                                user.id
                              )
                            }
                            className={`flex min-h-[48px] flex-1 items-center justify-between rounded-xl border px-3 py-3 text-left ${
                              selected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            <span>
                              {user.full_name ||
                                user.email}
                            </span>

                            <span>
                              {selected ? "✓" : "+"}
                            </span>
                          </button>

                          {selected &&
                            sharedExpenseMode ===
                              "custom" && (
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={
                                  sharedExpenseAmounts[
                                    user.id
                                  ] || ""
                                }
                                onChange={(event) =>
                                  setSharedExpenseAmounts(
                                    (current) => ({
                                      ...current,
                                      [user.id]:
                                        event.target.value,
                                    })
                                  )
                                }
                                placeholder="$"
                                className="w-24 rounded-xl border border-slate-300 px-2 py-3 text-sm"
                              />
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {sharedExpenseUsers.length > 0 && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm text-slate-600">
                      Tu parte
                    </p>

                    <p className="text-xl font-bold text-slate-900">
                      {money(obtenerCantidadDelCreador())}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={crearGastoCompartido}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
                >
                  Crear gasto
                </button>
              </div>
            </section>

            {/* SOLICITUDES DE GASTOS */}
            {gastosPorConfirmar.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-slate-900">
                  Gastos por aceptar
                </h2>

                <div className="space-y-3">
                  {gastosPorConfirmar.map((expense) => {
                    const participant =
                      sharedParticipants.find(
                        (p) =>
                          p.expense_id === expense.id &&
                          p.user_id === currentUserId
                      );

                    const creator = getProfile(
                      expense.created_by
                    );

                    return (
                      <article
                        key={expense.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                      >
                        <p className="text-lg font-bold text-slate-900">
                          {expense.title}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Creado por{" "}
                          {creator?.full_name ||
                            "Otra persona"}
                        </p>

                        <p className="mt-3 text-2xl font-bold text-slate-900">
                          {money(participant?.amount)}
                        </p>

                        <p className="text-sm text-slate-500">
                          Tu parte
                        </p>

                        {expense.description && (
                          <p className="mt-2 text-sm text-slate-600">
                            {expense.description}
                          </p>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={responseLoading}
                            onClick={() =>
                              responderGastoCompartido(
                                expense.id,
                                false
                              )
                            }
                            className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-700"
                          >
                            Rechazar
                          </button>

                          <button
                            type="button"
                            disabled={responseLoading}
                            onClick={() =>
                              responderGastoCompartido(
                                expense.id,
                                true
                              )
                            }
                            className="rounded-xl bg-slate-900 px-3 py-3 font-semibold text-white"
                          >
                            Aceptar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* MIS GASTOS */}
            <section>
              <h2 className="mb-3 text-lg font-bold text-slate-900">
                Mis gastos compartidos
              </h2>

              {misGastos.length === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">
                  No tienes gastos compartidos.
                </div>
              ) : (
                <div className="space-y-4">
                  {misGastos.map((expense) => {
                    const participants =
                      sharedParticipants.filter(
                        (participant) =>
                          participant.expense_id ===
                          expense.id
                      );

                    const isCreator =
                      expense.created_by ===
                      currentUserId;

                    return (
                      <article
                        key={expense.id}
                        className="rounded-2xl bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">
                              {expense.title}
                            </h3>

                            <p className="text-sm text-slate-500">
                              Total:{" "}
                              {money(expense.total_amount)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              expense.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : expense.status ===
                                  "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {expense.status === "active"
                              ? "Activo"
                              : expense.status ===
                                "cancelled"
                              ? "Cancelado"
                              : "Pendiente"}
                          </span>
                        </div>

                        {expense.description && (
                          <p className="mt-2 text-sm text-slate-600">
                            {expense.description}
                          </p>
                        )}

                        <div className="mt-4 space-y-2">
                          {participants.map(
                            (participant) => {
                              const person = getProfile(
                                participant.user_id
                              );

                              const isMe =
                                participant.user_id ===
                                currentUserId;

                              const canPay =
                                isMe &&
                                participant.accepted &&
                                !participant.paid;

                              const canConfirm =
                                isCreator &&
                                participant.paid &&
                                !participant.payment_confirmed;

                              return (
                                <div
                                  key={participant.id}
                                  className="rounded-xl border border-slate-200 p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900">
                                        {isMe
                                          ? "Tú"
                                          : person?.full_name ||
                                            person?.email ||
                                            "Participante"}
                                      </p>

                                      <p className="text-sm text-slate-500">
                                        Debe{" "}
                                        {money(
                                          participant.amount
                                        )}
                                      </p>
                                    </div>

                                    <div className="text-right">
                                      {!participant.accepted ? (
                                        <span className="text-xs font-semibold text-amber-600">
                                          Pendiente
                                        </span>
                                      ) : !participant.paid ? (
                                        <span className="text-xs font-semibold text-slate-500">
                                          No ha pagado
                                        </span>
                                      ) : participant.payment_confirmed ? (
                                        <span className="text-xs font-semibold text-emerald-600">
                                          Pago confirmado
                                        </span>
                                      ) : (
                                        <span className="text-xs font-semibold text-blue-600">
                                          Pago por confirmar
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {participant.payment_at && (
                                    <p className="mt-2 text-xs text-slate-500">
                                      Pagó:{" "}
                                      {dateText(
                                        participant.payment_at
                                      )}
                                    </p>
                                  )}

                                  {participant.payment_amount && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      Pagó{" "}
                                      {money(
                                        participant.payment_amount
                                      )}
                                    </p>
                                  )}

                                  {canPay && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        abrirPagoGasto(
                                          participant
                                        )
                                      }
                                      className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
                                    >
                                      Registrar pago
                                    </button>
                                  )}

                                  {participant.payment_evidence_url && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        verComprobanteGasto(
                                          participant.payment_evidence_url!
                                        )
                                      }
                                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
                                    >
                                      Ver comprobante
                                    </button>
                                  )}

                                  {canConfirm && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        confirmarPagoGasto(
                                          participant.id
                                        )
                                      }
                                      className="mt-2 w-full rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white"
                                    >
                                      Confirmar pago
                                    </button>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================================================= */}
        {/* HISTORIAL */}
        {/* ================================================= */}

        {activeTab === "historial" && (
          <div className="space-y-5">
            <section>
              <h2 className="mb-3 text-lg font-bold text-slate-900">
                Historial de préstamos
              </h2>

              {historialPrestamos.length === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">
                  Todavía no tienes movimientos en el historial.
                </div>
              ) : (
                <div className="space-y-3">
                  {historialPrestamos.map((loan) => {
                    const payment = getLoanPayment(
                      loan.id
                    );

                    const otherUserId =
                      loan.lender_id === currentUserId
                        ? loan.borrower_id
                        : loan.lender_id;

                    const other = getProfile(otherUserId);

                    return (
                      <article
                        key={loan.id}
                        className="rounded-2xl bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-lg font-bold text-slate-900">
                              {money(loan.amount)}
                            </p>

                            <p className="text-sm text-slate-600">
                              {other?.full_name ||
                                "Otra persona"}
                            </p>
                          </div>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {loan.status ===
                            "completed"
                              ? "Completado"
                              : loan.status ===
                                "rejected"
                              ? "Rechazado"
                              : "Cancelado"}
                          </span>
                        </div>

                        {loan.description && (
                          <p className="mt-2 text-sm text-slate-600">
                            {loan.description}
                          </p>
                        )}

                        {payment && (
                          <div className="mt-4 rounded-xl bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-slate-800">
                              Pago registrado
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              {money(payment.amount)}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {dateText(
                                payment.created_at
                              )}
                            </p>

                            {payment.evidence_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  verComprobante(
                                    payment.evidence_url!
                                  )
                                }
                                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
                              >
                                Ver comprobante
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ================================================= */}
      {/* MODAL PAGO PRÉSTAMO */}
      {/* ================================================= */}

      {paymentLoan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Registrar pago
              </h2>

              <button
                type="button"
                onClick={cerrarRegistroPago}
                className="rounded-lg px-3 py-2 text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) =>
                  setPaymentAmount(event.target.value)
                }
                placeholder="Cantidad pagada"
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
              />

              <div>
                <label
                  htmlFor="payment-file"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Comprobante
                </label>

                <input
                  id="payment-file"
                  type="file"
                  accept="image/*,.heic,.heif,.pdf"
                  multiple={false}
                  onChange={seleccionarComprobante}
                  className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
                />

                {paymentFile && (
                  <p className="mt-2 break-all text-xs text-slate-500">
                    Archivo: {paymentFile.name}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={registrarPago}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
              >
                Enviar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* MODAL PAGO GASTO */}
      {/* ================================================= */}

      {sharedPaymentParticipant && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Registrar pago
                </h2>

                <p className="text-sm text-slate-500">
                  Tu parte:{" "}
                  {money(sharedPaymentParticipant.amount)}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarPagoGasto}
                className="rounded-lg px-3 py-2 text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={sharedPaymentAmount}
                onChange={(event) =>
                  setSharedPaymentAmount(
                    event.target.value
                  )
                }
                placeholder="Cantidad pagada"
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
              />

              <div>
                <label
                  htmlFor="shared-payment-file"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Comprobante
                </label>

                <input
                  id="shared-payment-file"
                  type="file"
                  accept="image/*,.heic,.heif,.pdf"
                  multiple={false}
                  onChange={seleccionarComprobanteGasto}
                  className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
                />

                {sharedPaymentFile && (
                  <p className="mt-2 break-all text-xs text-slate-500">
                    Archivo: {sharedPaymentFile.name}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={registrarPagoGasto}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
              >
                Enviar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* MODAL GENERAL */}
      {/* ================================================= */}

      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5">
            <h2 className="text-lg font-bold text-slate-900">
              {modal.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {modal.message}
            </p>

            <button
              type="button"
              onClick={() => setModal(null)}
              className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}