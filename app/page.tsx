"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

import {
  registrarPrestamo as registrarPrestamoService,
  responderSolicitud as responderSolicitudService,
  confirmarRecepcion as confirmarRecepcionService,
  registrarPago as registrarPagoService,
  verComprobante as verComprobanteService,
} from "../lib/prestamos";

import {
  crearGastoCompartido as crearGastoCompartidoService,
  editarGastoCompartido as editarGastoCompartidoService,
  eliminarGastoCompartido as eliminarGastoCompartidoService,
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
  payment_amount: number | null;
  payment_evidence_url: string | null;
  payment_at: string | null;
  payment_confirmed: boolean;
  payment_confirmed_at: string | null;
  created_at: string;
};

type ModalData = {
  title: string;
  message: string;
  type?: "success" | "error" | "info";
};

const supabase = createClient();

export default function Home() {
  const [email, setEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Refs para evitar recargas que desmontan los inputs de archivo en móvil
  const currentUserIdRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  const [users, setUsers] = useState<Profile[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>([]);
  const [sharedParticipants, setSharedParticipants] = useState<
    SharedExpenseParticipant[]
  >([]);

  // ============================================================
  // PAGO DE GASTO COMPARTIDO
  // ============================================================

  const [sharedPaymentExpense, setSharedPaymentExpense] =
    useState<SharedExpense | null>(null);
  const [sharedPaymentAmount, setSharedPaymentAmount] = useState("");
  const [sharedPaymentFile, setSharedPaymentFile] = useState<File | null>(
    null
  );
  const [sharedPaymentSending, setSharedPaymentSending] = useState(false);

  // ============================================================
  // NAVEGACIÓN
  // ============================================================

  const [activeTab, setActiveTab] = useState<
    "prestamos" | "gastos" | "historial"
  >("prestamos");

  // ============================================================
  // PRÉSTAMOS
  // ============================================================

  const [selectedUser, setSelectedUser] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);

  // ============================================================
  // GASTOS COMPARTIDOS
  // ============================================================

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

  // Parte que paga el creador cuando la división es personalizada
  const [sharedCreatorAmount, setSharedCreatorAmount] = useState("");

  // Edición / eliminación de gastos
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(
    null
  );
  const [expenseToDelete, setExpenseToDelete] =
    useState<SharedExpense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ============================================================
  // ESTADOS
  // ============================================================

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [paymentSending, setPaymentSending] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [responseLoading, setResponseLoading] = useState<string | null>(
    null
  );

  const [sharedExpenseLoading, setSharedExpenseLoading] = useState(false);

  const [modal, setModal] = useState<ModalData | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // ============================================================
  // HELPERS
  // ============================================================

  function mostrarModal(
    title: string,
    message: string,
    type: "success" | "error" | "info" = "info"
  ) {
    setModal({ title, message, type });
  }

  function cerrarModal() {
    setModal(null);
  }

  function formatearMonto(value: number | string) {
    return Number(value || 0).toLocaleString("es-MX", {
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

  function formatearFechaHora(value: string | null) {
    if (!value) return "Sin fecha";

    return new Date(value).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function obtenerNombre(userId: string) {
    if (userId === currentUserId) {
      return "Tú";
    }

    const user = users.find((item) => item.id === userId);

    return user?.full_name || user?.email || "Usuario";
  }

  // ============================================================
  // CARGAR DATOS
  // ============================================================

  async function loadData() {
    try {
      // Solo mostramos "Cargando..." la primera vez. Si no, el input de
      // archivo se desmonta mientras el usuario elige una foto en el móvil.
      if (!initialLoadDone.current) {
        setLoading(true);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        currentUserIdRef.current = null;
        setCurrentUserId(null);
        setEmail("");
        return;
      }

      const userId = session.user.id;

      currentUserIdRef.current = userId;
      setCurrentUserId(userId);
      setEmail(session.user.email || "");

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, is_admin, is_active")
        .eq("is_active", true)
        .neq("id", userId)
        .order("full_name", { ascending: true });

      if (profilesError) {
        console.error("Error cargando usuarios:", profilesError);
      } else {
        setUsers(profilesData || []);
      }

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

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("loan_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (paymentsError) {
        console.error("Error cargando pagos:", paymentsError);
      } else {
        setPayments(paymentsData || []);
      }

      const { data: expensesData, error: expensesError } = await supabase
        .from("shared_expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (expensesError) {
        console.error("Error cargando gastos compartidos:", expensesError);
      } else {
        setSharedExpenses(expensesData || []);
      }

      const { data: participantsData, error: participantsError } =
        await supabase.from("shared_expense_participants").select("*");

      if (participantsError) {
        console.error("Error cargando participantes:", participantsError);
      } else {
        setSharedParticipants(participantsData || []);
      }
    } catch (error) {
      console.error("Error general cargando datos:", error);
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }

  // ============================================================
  // EFECTOS
  // ============================================================

  useEffect(() => {
    loadData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Mismo usuario (refresco de token, regreso del foco): no recargar
        if (currentUserIdRef.current === session.user.id) return;

        currentUserIdRef.current = session.user.id;
        setCurrentUserId(session.user.id);
        setEmail(session.user.email || "");

        setTimeout(() => {
          loadData();
        }, 0);
      } else {
        currentUserIdRef.current = null;
        initialLoadDone.current = false;
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

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  // ============================================================
  // LOGIN
  // ============================================================

  async function loginWithGoogle() {
    try {
      setLoginLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback/`,
        },
      });

      if (error) throw error;
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

  // ============================================================
  // LOGOUT
  // ============================================================

  async function cerrarSesion() {
    await supabase.auth.signOut();

    currentUserIdRef.current = null;
    initialLoadDone.current = false;
    setCurrentUserId(null);
    setEmail("");
    setLoans([]);
    setPayments([]);
    setUsers([]);
    setSharedExpenses([]);
    setSharedParticipants([]);
  }

  // ============================================================
  // PWA
  // ============================================================

  async function instalarAplicacion() {
    if (!installPrompt) return;

    installPrompt.prompt();

    try {
      await installPrompt.userChoice;
    } catch {
      // Usuario canceló.
    }

    setInstallPrompt(null);
  }

  // ============================================================
  // REGISTRAR PRÉSTAMO
  // ============================================================

  async function registrarPrestamo() {
    if (!currentUserId) {
      mostrarModal("Sesión requerida", "No hay una sesión activa.", "error");
      return;
    }

    if (!selectedUser) {
      mostrarModal(
        "Falta seleccionar",
        "Selecciona a la persona a quien le prestaste.",
        "error"
      );
      return;
    }

    const numero = Number(amount);

    if (!numero || numero <= 0) {
      mostrarModal("Monto inválido", "Escribe un monto válido.", "error");
      return;
    }

    if (selectedUser === currentUserId) {
      mostrarModal(
        "Persona inválida",
        "No puedes registrarte un préstamo a ti mismo.",
        "error"
      );
      return;
    }

    try {
      setSending(true);

      const nombreDestinatario = obtenerNombre(selectedUser);

      await registrarPrestamoService({
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
        "Préstamo registrado",
        `Registraste que le prestaste ${formatearMonto(
          numero
        )} a ${nombreDestinatario}. Esa persona debe confirmarlo.`,
        "success"
      );
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo registrar",
        error?.message || "Ocurrió un error registrando el préstamo.",
        "error"
      );
    } finally {
      setSending(false);
    }
  }

  // ============================================================
  // CONFIRMAR / RECHAZAR PRÉSTAMO
  // ============================================================

  async function responderSolicitud(loanId: string, aceptar: boolean) {
    try {
      setResponseLoading(loanId);

      await responderSolicitudService(loanId, aceptar);

      await loadData();

      mostrarModal(
        aceptar ? "Préstamo confirmado" : "Préstamo rechazado",
        aceptar
          ? "Confirmaste que recibiste este préstamo. Ahora queda activo."
          : "Indicaste que no reconoces este préstamo.",
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
  // PAGOS DE PRÉSTAMOS
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

  function seleccionarComprobante(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      setPaymentFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      mostrarModal(
        "Archivo demasiado grande",
        "El comprobante debe pesar máximo 10 MB.",
        "error"
      );

      event.target.value = "";
      setPaymentFile(null);
      return;
    }

    setPaymentFile(file);
  }

  async function registrarPago() {
    if (!paymentLoan || !currentUserId) return;

    const numero = Number(paymentAmount);

    if (!numero || numero <= 0) {
      mostrarModal("Monto inválido", "Escribe un monto válido.", "error");
      return;
    }

    if (!paymentFile) {
      mostrarModal(
        "Falta comprobante",
        "Debes seleccionar una imagen o PDF como comprobante.",
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

  // ============================================================
  // COMPROBANTE DE PRÉSTAMO
  // ============================================================

  async function verComprobante(path: string | null) {
    if (!path) {
      mostrarModal("Sin comprobante", "Este pago no tiene comprobante.", "info");
      return;
    }

    try {
      const url = await verComprobanteService(path);

      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
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

  // ============================================================
  // CONFIRMAR RECEPCIÓN PRÉSTAMO
  // ============================================================

  async function confirmarRecepcion(loanId: string) {
    try {
      setResponseLoading(loanId);

      await confirmarRecepcionService(loanId);

      await loadData();

      mostrarModal(
        "Pago confirmado",
        "Confirmaste que recibiste el pago. El préstamo quedó completado.",
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

    if (!total || cantidadPersonas <= 1) {
      return 0;
    }

    // Los centavos que sobran por redondeo quedan en la parte del creador.
    const parteInvitado = Math.floor((total / cantidadPersonas) * 100) / 100;

    return Math.round(parteInvitado * 100) / 100;
  }

  function obtenerMiParteGasto(expense: SharedExpense) {
    const participantes = sharedParticipants.filter(
      (participant) => participant.expense_id === expense.id
    );

    const sumaParticipantes = participantes.reduce(
      (sum, participant) => sum + Number(participant.amount),
      0
    );

    return Math.round((Number(expense.total_amount) - sumaParticipantes) * 100) / 100;
  }

  function limpiarFormularioGasto() {
    setEditingExpenseId(null);
    setSharedExpenseTitle("");
    setSharedExpenseDescription("");
    setSharedExpenseTotal("");
    setSharedExpenseUsers([]);
    setSharedExpenseMode("equal");
    setSharedCustomAmounts({});
    setSharedCreatorAmount("");
    setShowSharedExpenseForm(false);
  }

  function gastoTienePagos(expenseId: string) {
    return sharedParticipants.some(
      (participant) =>
        participant.expense_id === expenseId && participant.paid
    );
  }

  function iniciarEdicionGasto(expense: SharedExpense) {
    const participantes = sharedParticipants.filter(
      (participant) => participant.expense_id === expense.id
    );

    const montos = participantes.map((participant) =>
      Number(participant.amount)
    );

    const todosIguales =
      montos.length > 0 &&
      montos.every((monto) => Math.abs(monto - montos[0]) < 0.011);

    setEditingExpenseId(expense.id);
    setSharedExpenseTitle(expense.title);
    setSharedExpenseDescription(expense.description || "");
    setSharedExpenseTotal(String(expense.total_amount));
    setSharedExpenseUsers(participantes.map((participant) => participant.user_id));
    setSharedExpenseMode(todosIguales ? "equal" : "custom");

    const sumaParticipantes = participantes.reduce(
      (sum, participant) => sum + Number(participant.amount),
      0
    );

    setSharedCreatorAmount(
      String(
        Math.round((Number(expense.total_amount) - sumaParticipantes) * 100) / 100
      )
    );
    setSharedCustomAmounts(
      Object.fromEntries(
        participantes.map((participant) => [
          participant.user_id,
          String(participant.amount),
        ])
      )
    );
    setShowSharedExpenseForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardarGastoCompartido() {
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
      mostrarModal("Monto inválido", "El total debe ser mayor a cero.", "error");
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

    if (sharedExpenseMode === "equal") {
      // La parte de los invitados se calcula en obtenerCantidadCompartida.
      // El sobrante de centavos queda automáticamente en la parte del creador.
    } else {
      const creatorAmount = Number(sharedCreatorAmount || 0);

      const sumaOtros = sharedExpenseUsers.reduce(
        (sum, userId) => sum + Number(sharedCustomAmounts[userId] || 0),
        0
      );

      const cantidadesInvalidas = sharedExpenseUsers.some(
        (userId) => Number(sharedCustomAmounts[userId] || 0) <= 0
      );

      if (creatorAmount <= 0 || cantidadesInvalidas) {
        mostrarModal(
          "Faltan cantidades",
          "Escribe cuánto pagarás tú y cuánto pagará cada participante.",
          "error"
        );
        return;
      }

      if (Math.abs(creatorAmount + sumaOtros - total) > 0.01) {
        mostrarModal(
          "Montos inválidos",
          "Tu parte más la de los participantes debe ser igual al total.",
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

      const editando = editingExpenseId !== null;

      if (editando) {
        await editarGastoCompartidoService({
          expenseId: editingExpenseId!,
          title: sharedExpenseTitle.trim(),
          description: sharedExpenseDescription.trim() || null,
          totalAmount: total,
          participants,
        });
      } else {
        await crearGastoCompartidoService({
          title: sharedExpenseTitle.trim(),
          description: sharedExpenseDescription.trim() || null,
          totalAmount: total,
          participants,
        });
      }

      limpiarFormularioGasto();

      await loadData();

      mostrarModal(
        editando ? "Gasto actualizado" : "Gasto creado",
        editando
          ? "Se guardaron los cambios. Quienes tengan un monto distinto deberán aceptar de nuevo."
          : "Las personas seleccionadas recibieron la solicitud.",
        "success"
      );
    } catch (error: any) {
      console.error(error);

      mostrarModal(
        "No se pudo guardar",
        error?.message || "Ocurrió un error guardando el gasto.",
        "error"
      );
    } finally {
      setSharedExpenseLoading(false);
    }
  }

  async function confirmarEliminarGasto() {
    if (!expenseToDelete) return;

    try {
      setDeleteLoading(true);

      await eliminarGastoCompartidoService(expenseToDelete.id);

      setExpenseToDelete(null);

      await loadData();

      mostrarModal(
        "Gasto eliminado",
        "El gasto se eliminó correctamente.",
        "success"
      );
    } catch (error: any) {
      console.error(error);

      setExpenseToDelete(null);

      mostrarModal(
        "No se pudo eliminar",
        error?.message || "Ocurrió un error.",
        "error"
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  // ============================================================
  // RESPONDER GASTO
  // ============================================================

  async function responderGastoCompartido(
    expenseId: string,
    aceptar: boolean
  ) {
    try {
      setResponseLoading(expenseId);

      await responderGastoCompartidoService(expenseId, aceptar);

      await loadData();

      mostrarModal(
        aceptar ? "Gasto aceptado" : "Gasto rechazado",
        aceptar
          ? "Aceptaste tu parte del gasto. Ahora puedes registrar tu pago."
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
  // PAGO DE GASTO COMPARTIDO
  // ============================================================

  function abrirPagoGastoCompartido(
    expense: SharedExpense,
    participant: SharedExpenseParticipant
  ) {
    setSharedPaymentExpense(expense);
    setSharedPaymentAmount(String(participant.amount));
    setSharedPaymentFile(null);
  }

  function cerrarPagoGastoCompartido() {
    setSharedPaymentExpense(null);
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

    if (file.size > 10 * 1024 * 1024) {
      mostrarModal(
        "Archivo demasiado grande",
        "El comprobante debe pesar máximo 10 MB.",
        "error"
      );

      event.target.value = "";
      setSharedPaymentFile(null);
      return;
    }

    setSharedPaymentFile(file);
  }

  async function registrarPagoGastoCompartido() {
    if (!sharedPaymentExpense || !currentUserId) {
      return;
    }

    const numero = Number(sharedPaymentAmount);

    if (!numero || numero <= 0) {
      mostrarModal("Monto inválido", "Escribe un monto válido.", "error");
      return;
    }

    if (!sharedPaymentFile) {
      mostrarModal(
        "Falta comprobante",
        "Debes seleccionar una imagen o PDF.",
        "error"
      );
      return;
    }

    try {
      setSharedPaymentSending(true);

      await registrarPagoGastoCompartidoService({
        expenseId: sharedPaymentExpense.id,
        amount: numero,
        file: sharedPaymentFile,
      });

      cerrarPagoGastoCompartido();

      await loadData();

      mostrarModal(
        "Pago registrado",
        "El comprobante quedó registrado. Ahora quien pagó el gasto debe confirmar el pago.",
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
      setSharedPaymentSending(false);
    }
  }

  // ============================================================
  // CONFIRMAR PAGO DE GASTO
  // ============================================================

  async function confirmarPagoGastoCompartido(
    expenseId: string,
    participantUserId: string
  ) {
    try {
      setResponseLoading(`${expenseId}-${participantUserId}`);

      await confirmarPagoGastoCompartidoService(expenseId, participantUserId);

      await loadData();

      mostrarModal(
        "Pago confirmado",
        "Confirmaste que recibiste este pago.",
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
  // COMPROBANTE DE GASTO
  // ============================================================

  async function verComprobanteGastoCompartido(path: string | null) {
    if (!path) {
      mostrarModal("Sin comprobante", "Este pago no tiene comprobante.", "info");
      return;
    }

    try {
      const url = await verComprobanteGastoCompartidoService(path);

      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
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

  // ============================================================
  // DATOS DERIVADOS
  // ============================================================

  const misPrestamos = loans.filter(
    (loan) =>
      loan.status === "active" &&
      (loan.lender_id === currentUserId ||
        loan.borrower_id === currentUserId)
  );

  const prestamosPorConfirmar = loans.filter(
    (loan) =>
      loan.status === "pending" && loan.borrower_id === currentUserId
  );

  const pagosPendientes = loans.filter(
    (loan) =>
      loan.status === "payment_pending" && loan.lender_id === currentUserId
  );

  const historialPrestamos = loans.filter(
    (loan) =>
      loan.status === "completed" ||
      loan.status === "rejected" ||
      loan.status === "cancelled"
  );

  const gastosPendientes = sharedExpenses.filter((expense) => {
    if (!currentUserId) return false;

    if (expense.status !== "pending") return false;

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
      expense.status === "completed" || expense.status === "cancelled"
  );

  // ============================================================
  // CARGANDO
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-3xl mb-3">💸</div>
          <p className="text-slate-600">Cargando...</p>
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

            <h1 className="text-2xl font-bold text-slate-900">Préstamos</h1>

            <p className="text-slate-500 mt-2">
              Registra préstamos y gastos compartidos entre tu grupo.
            </p>
          </div>

          <button
            onClick={loginWithGoogle}
            disabled={loginLoading}
            className="w-full mt-7 rounded-2xl bg-slate-900 text-white py-4 font-semibold disabled:opacity-50"
          >
            {loginLoading ? "Conectando..." : "Continuar con Google"}
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
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Conectado como</p>

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
        {/* ====================================================
            INSTALAR
        ==================================================== */}

        {installPrompt && (
          <button
            onClick={instalarAplicacion}
            className="w-full mb-5 rounded-2xl bg-indigo-600 text-white py-3 font-semibold"
          >
            📱 Instalar aplicación
          </button>
        )}

        {/* ====================================================
            PRÉSTAMOS
        ==================================================== */}

        {activeTab === "prestamos" && (
          <div className="space-y-5">
            {/* REGISTRAR PRÉSTAMO */}

            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Registrar dinero prestado
                </h2>

                <p className="text-sm text-slate-700 mt-1">
                  Registra a quién le prestaste dinero. Esa persona deberá
                  confirmar el préstamo.
                </p>
              </div>

              <div className="space-y-3">
                <select
                  value={selectedUser}
                  onChange={(event) => setSelectedUser(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900"
                >
                  <option value="">¿A quién le prestaste?</option>

                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="¿Cuánto le prestaste?"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                />

                <input
                  type="text"
                  placeholder="Concepto (opcional)"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                />

                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900"
                />

                <button
                  onClick={registrarPrestamo}
                  disabled={sending}
                  className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold disabled:opacity-50"
                >
                  {sending ? "Registrando..." : "Registrar préstamo"}
                </button>
              </div>
            </section>

            {/* PRÉSTAMOS POR CONFIRMAR */}

            {prestamosPorConfirmar.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">
                  Préstamos por confirmar
                </h2>

                <div className="space-y-3">
                  {prestamosPorConfirmar.map((loan) => (
                    <div
                      key={loan.id}
                      className="bg-white rounded-3xl border border-amber-200 p-5 shadow-sm"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {obtenerNombre(loan.lender_id)}
                          </p>

                          <p className="text-sm text-slate-700 mt-1">
                            Registró que te prestó este dinero
                          </p>

                          <p className="text-sm text-slate-700 mt-1">
                            {loan.description || "Préstamo"}
                          </p>
                        </div>

                        <p className="font-bold text-lg text-slate-900">
                          {formatearMonto(loan.amount)}
                        </p>
                      </div>

                      <div className="mt-4 text-sm text-slate-700 space-y-1">
                        <p>
                          Fecha del registro: {formatearFecha(loan.created_at)}
                        </p>

                        <p>Fecha límite: {formatearFecha(loan.due_date)}</p>
                      </div>

                      <p className="text-sm text-amber-800 mt-4">
                        Confirma si efectivamente recibiste este préstamo.
                      </p>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={() => responderSolicitud(loan.id, true)}
                          disabled={responseLoading === loan.id}
                          className="rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
                        >
                          {responseLoading === loan.id
                            ? "Confirmando..."
                            : "Sí, confirmar"}
                        </button>

                        <button
                          onClick={() => responderSolicitud(loan.id, false)}
                          disabled={responseLoading === loan.id}
                          className="rounded-2xl bg-red-100 text-red-700 py-3 font-semibold disabled:opacity-50"
                        >
                          No lo reconozco
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PRÉSTAMOS ACTIVOS */}

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                Préstamos activos
              </h2>

              {misPrestamos.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center">
                  <p className="text-slate-700">No tienes préstamos activos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {misPrestamos.map((loan) => {
                    const soyPrestamista = loan.lender_id === currentUserId;
                    const soyDeudor = loan.borrower_id === currentUserId;

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
                                : `Te prestó ${obtenerNombre(loan.lender_id)}`}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              {loan.description || "Préstamo"}
                            </p>
                          </div>

                          <p className="font-bold text-lg whitespace-nowrap text-slate-900">
                            {formatearMonto(loan.amount)}
                          </p>
                        </div>

                        <div className="mt-4 text-sm text-slate-700 space-y-1">
                          <p>Registrado: {formatearFecha(loan.created_at)}</p>

                          <p>Fecha límite: {formatearFecha(loan.due_date)}</p>
                        </div>

                        <div className="mt-4">
                          {soyDeudor && (
                            <button
                              onClick={() => abrirRegistroPago(loan)}
                              className="w-full rounded-2xl bg-slate-900 text-white py-3 font-semibold"
                            >
                              Registrar pago
                            </button>
                          )}

                          {soyPrestamista && (
                            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
                              Esperando el pago de{" "}
                              {obtenerNombre(loan.borrower_id)}.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* PAGOS POR CONFIRMAR */}

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
                        className="bg-white rounded-3xl border border-amber-200 p-5 shadow-sm"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {obtenerNombre(loan.borrower_id)}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              Registró un pago de este préstamo.
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              {loan.description || "Préstamo"}
                            </p>
                          </div>

                          <p className="font-bold text-lg text-slate-900 whitespace-nowrap">
                            {formatearMonto(payment?.amount || loan.amount)}
                          </p>
                        </div>

                        <div className="mt-4 text-sm text-slate-700 space-y-1">
                          <p>
                            Préstamo original: {formatearMonto(loan.amount)}
                          </p>

                          <p>
                            Pago registrado:{" "}
                            {formatearMonto(payment?.amount || loan.amount)}
                          </p>

                          <p>
                            Fecha del pago:{" "}
                            {formatearFechaHora(payment?.created_at || null)}
                          </p>

                          <p>
                            Fecha límite original:{" "}
                            {formatearFecha(loan.due_date)}
                          </p>
                        </div>

                        {loan.description && (
                          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase">
                              Concepto
                            </p>

                            <p className="text-sm text-slate-900 mt-1">
                              {loan.description}
                            </p>
                          </div>
                        )}

                        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                          <p className="font-semibold text-amber-900">
                            Revisa el comprobante
                          </p>

                          <p className="text-sm text-amber-800 mt-1">
                            Confirma la recepción solamente si efectivamente
                            recibiste este pago.
                          </p>
                        </div>

                        {payment?.evidence_url && (
                          <button
                            onClick={() => verComprobante(payment.evidence_url)}
                            className="w-full mt-4 rounded-2xl bg-slate-100 text-slate-800 py-3 font-semibold"
                          >
                            Ver comprobante
                          </button>
                        )}

                        <button
                          onClick={() => confirmarRecepcion(loan.id)}
                          disabled={responseLoading === loan.id}
                          className="w-full mt-2 rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
                        >
                          {responseLoading === loan.id
                            ? "Confirmando..."
                            : "Confirmar que recibí el pago"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ====================================================
            GASTOS COMPARTIDOS
        ==================================================== */}

        {activeTab === "gastos" && (
          <div className="space-y-5">
            {/* CREAR / EDITAR GASTO */}

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingExpenseId
                      ? "Editar gasto"
                      : "Gastos compartidos"}
                  </h2>

                  <p className="text-sm text-slate-700 mt-1">
                    Tú pagas el total y las personas seleccionadas te pagan su
                    parte.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (showSharedExpenseForm) {
                      limpiarFormularioGasto();
                    } else {
                      setShowSharedExpenseForm(true);
                    }
                  }}
                  className="rounded-2xl bg-slate-900 text-white px-4 py-3 font-semibold"
                >
                  {showSharedExpenseForm ? "Cerrar" : "Nuevo"}
                </button>
              </div>

              {showSharedExpenseForm && (
                <div className="mt-5 space-y-4">
                  {editingExpenseId && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                      Estás editando este gasto. Quienes cambien de monto
                      deberán aceptar de nuevo.
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="¿Qué pagaste?"
                    value={sharedExpenseTitle}
                    onChange={(event) =>
                      setSharedExpenseTitle(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                  />

                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Total"
                    value={sharedExpenseTotal}
                    onChange={(event) =>
                      setSharedExpenseTotal(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                  />

                  <textarea
                    placeholder="Descripción (opcional)"
                    value={sharedExpenseDescription}
                    onChange={(event) =>
                      setSharedExpenseDescription(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500 min-h-24"
                  />

                  <div>
                    <p className="font-semibold text-slate-900 mb-2">
                      ¿Quiénes te deben pagar?
                    </p>

                    <div className="space-y-2">
                      {users.map((user) => {
                        const selected = sharedExpenseUsers.includes(user.id);

                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleSharedExpenseUser(user.id)}
                            className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left text-slate-900 ${selected
                                ? "border-slate-900 bg-slate-100"
                                : "border-slate-200 bg-white"
                              }`}
                          >
                            <span>{user.full_name || user.email}</span>

                            <span>{selected ? "✓" : "○"}</span>
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
                            type="button"
                            onClick={() => setSharedExpenseMode("equal")}
                            className={`rounded-2xl py-3 font-semibold ${sharedExpenseMode === "equal"
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            Partes iguales
                          </button>

                          <button
                            type="button"
                            onClick={() => setSharedExpenseMode("custom")}
                            className={`rounded-2xl py-3 font-semibold ${sharedExpenseMode === "custom"
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            Cantidades
                          </button>
                        </div>
                      </div>

                      {sharedExpenseMode === "equal" && (
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                          <p className="text-sm text-slate-600">
                            Cada persona (incluyéndote) paga:
                          </p>

                          <p className="text-xl font-bold text-slate-900 mt-1">
                            {formatearMonto(
                              obtenerCantidadCompartida(sharedExpenseUsers[0])
                            )}
                          </p>

                          <p className="text-sm text-slate-700 mt-2">
                            Tu parte: {formatearMonto(
                              Number(sharedExpenseTotal || 0) -
                                obtenerCantidadCompartida(sharedExpenseUsers[0]) *
                                  sharedExpenseUsers.length
                            )}
                          </p>
                        </div>
                      )}

                      {sharedExpenseMode === "custom" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 font-semibold">
                              Tu parte (tú)
                            </div>

                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              placeholder="$"
                              value={sharedCreatorAmount}
                              onChange={(event) =>
                                setSharedCreatorAmount(event.target.value)
                              }
                              className="w-28 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                            />
                          </div>

                          {sharedExpenseUsers.map((userId) => (
                            <div
                              key={userId}
                              className="flex items-center gap-2"
                            >
                              <div className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-slate-900">
                                {obtenerNombre(userId)}
                              </div>

                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="$"
                                value={sharedCustomAmounts[userId] || ""}
                                onChange={(event) =>
                                  setSharedCustomAmounts((current) => ({
                                    ...current,
                                    [userId]: event.target.value,
                                  }))
                                }
                                className="w-28 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={guardarGastoCompartido}
                        disabled={sharedExpenseLoading}
                        className="w-full rounded-2xl bg-slate-900 text-white py-3.5 font-semibold disabled:opacity-50"
                      >
                        {sharedExpenseLoading
                          ? "Guardando..."
                          : editingExpenseId
                            ? "Guardar cambios"
                            : "Crear gasto compartido"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* SOLICITUDES */}

            {gastosPendientes.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">
                  Gastos por confirmar
                </h2>

                <div className="space-y-3">
                  {gastosPendientes.map((expense) => {
                    const participant = sharedParticipants.find(
                      (item) =>
                        item.expense_id === expense.id &&
                        item.user_id === currentUserId
                    );

                    return (
                      <div
                        key={expense.id}
                        className="bg-white rounded-3xl border border-amber-200 p-5 shadow-sm"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {expense.title}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              Pagado por {obtenerNombre(expense.created_by)}
                            </p>
                          </div>

                          <p className="font-bold text-lg text-slate-900 whitespace-nowrap">
                            {formatearMonto(participant?.amount || 0)}
                          </p>
                        </div>

                        {expense.description && (
                          <p className="text-sm text-slate-700 mt-3">
                            {expense.description}
                          </p>
                        )}

                        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                          <p className="font-semibold text-amber-900">
                            Te están pidiendo pagar tu parte
                          </p>

                          <p className="text-sm text-amber-800 mt-1">
                            Si aceptas, después podrás registrar tu pago y subir
                            el comprobante.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() =>
                              responderGastoCompartido(expense.id, true)
                            }
                            disabled={responseLoading === expense.id}
                            className="rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
                          >
                            {responseLoading === expense.id
                              ? "Guardando..."
                              : "Aceptar"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              responderGastoCompartido(expense.id, false)
                            }
                            disabled={responseLoading === expense.id}
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
                  {misGastosCompartidos.map((expense) => {
                    const soyCreador = expense.created_by === currentUserId;

                    const miParticipacion = sharedParticipants.find(
                      (item) =>
                        item.expense_id === expense.id &&
                        item.user_id === currentUserId
                    );

                    const otrosParticipantes = sharedParticipants.filter(
                      (item) =>
                        item.expense_id === expense.id &&
                        item.user_id !== currentUserId
                    );

                    const tienePagos = gastoTienePagos(expense.id);

                    return (
                      <div
                        key={expense.id}
                        className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {expense.title}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              Total: {formatearMonto(expense.total_amount)}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              Pagó el total: {obtenerNombre(expense.created_by)}
                            </p>
                          </div>

                          <span
                            className={`inline-flex h-fit rounded-full px-3 py-1 text-xs font-semibold ${expense.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : expense.status === "pending"
                                  ? "bg-amber-100 text-amber-700"
                                  : expense.status === "completed"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                          >
                            {expense.status === "active"
                              ? "Activo"
                              : expense.status === "pending"
                                ? "Pendiente"
                                : expense.status === "completed"
                                  ? "Completado"
                                  : "Cancelado"}
                          </span>
                        </div>

                        {expense.description && (
                          <p className="text-sm text-slate-700 mt-3">
                            {expense.description}
                          </p>
                        )}

                        {/* SI YO SOY PARTICIPANTE */}

                        {!soyCreador && miParticipacion && (
                          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-900">
                              Mi parte
                            </p>

                            <p className="text-2xl font-bold text-slate-900 mt-1">
                              {formatearMonto(miParticipacion.amount)}
                            </p>

                            {!miParticipacion.accepted && (
                              <p className="text-sm text-amber-700 mt-2">
                                Falta aceptar la solicitud.
                              </p>
                            )}

                            {miParticipacion.accepted &&
                              !miParticipacion.paid && (
                                <>
                                  <p className="text-sm text-red-700 mt-2">
                                    Falta registrar tu pago.
                                  </p>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      abrirPagoGastoCompartido(
                                        expense,
                                        miParticipacion
                                      )
                                    }
                                    className="w-full mt-3 rounded-2xl bg-slate-900 text-white py-3 font-semibold"
                                  >
                                    Registrar mi pago
                                  </button>
                                </>
                              )}

                            {miParticipacion.paid && (
                              <div className="mt-3">
                                <p className="text-sm text-emerald-700 font-semibold">
                                  ✓ Pago registrado
                                </p>

                                {miParticipacion.payment_amount && (
                                  <p className="text-sm text-slate-700 mt-1">
                                    Pagaste:{" "}
                                    {formatearMonto(
                                      miParticipacion.payment_amount
                                    )}
                                  </p>
                                )}

                                {miParticipacion.payment_confirmed ? (
                                  <p className="text-sm text-emerald-700 mt-2 font-semibold">
                                    ✓ El pago fue confirmado.
                                  </p>
                                ) : (
                                  <p className="text-sm text-amber-700 mt-2">
                                    Esperando confirmación de quien pagó el
                                    gasto.
                                  </p>
                                )}

                                {miParticipacion.payment_evidence_url && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      verComprobanteGastoCompartido(
                                        miParticipacion.payment_evidence_url
                                      )
                                    }
                                    className="w-full mt-3 rounded-2xl bg-white border border-slate-300 text-slate-800 py-3 font-semibold"
                                  >
                                    Ver mi comprobante
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* SI YO SOY EL CREADOR */}

                        {soyCreador && (
                          <>
                            <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                              <p className="text-sm text-slate-700">
                                Tu parte: <span className="font-bold text-slate-900">
                                  {formatearMonto(obtenerMiParteGasto(expense))}
                                </span>
                              </p>

                              <p className="text-sm text-slate-700 mt-1">
                                Tú pagaste el total de este gasto por adelantado.
                              </p>

                              <p className="text-sm text-slate-700 mt-1">
                                Los participantes deben aceptar y después
                                pagarte su parte.
                              </p>
                            </div>

                            {!tienePagos &&
                              expense.status !== "completed" &&
                              expense.status !== "cancelled" && (
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                  <button
                                    type="button"
                                    onClick={() => iniciarEdicionGasto(expense)}
                                    className="rounded-2xl bg-slate-100 text-slate-800 py-3 font-semibold"
                                  >
                                    ✏️ Editar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setExpenseToDelete(expense)}
                                    className="rounded-2xl bg-red-100 text-red-700 py-3 font-semibold"
                                  >
                                    🗑️ Eliminar
                                  </button>
                                </div>
                              )}

                            {tienePagos && (
                              <p className="text-xs text-slate-500 mt-3">
                                Ya hay pagos registrados, por eso no se puede
                                editar ni eliminar.
                              </p>
                            )}

                            <div className="mt-5">
                              <p className="text-sm font-semibold text-slate-900 mb-2">
                                Quién debe pagar
                              </p>

                              {otrosParticipantes.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                  No hay participantes.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {otrosParticipantes.map((item) => {
                                    const loadingId = `${expense.id}-${item.user_id}`;

                                    return (
                                      <div
                                        key={item.id}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                      >
                                        <div className="flex justify-between gap-3">
                                          <div>
                                            <p className="font-semibold text-slate-900">
                                              {obtenerNombre(item.user_id)}
                                            </p>

                                            <p className="text-sm text-slate-600 mt-1">
                                              Debe pagar:{" "}
                                              {formatearMonto(item.amount)}
                                            </p>
                                          </div>

                                          <div className="text-right">
                                            {!item.accepted ? (
                                              <span className="text-xs font-semibold text-amber-700">
                                                Falta aceptar
                                              </span>
                                            ) : !item.paid ? (
                                              <span className="text-xs font-semibold text-red-700">
                                                Falta pagar
                                              </span>
                                            ) : item.payment_confirmed ? (
                                              <span className="text-xs font-semibold text-emerald-700">
                                                ✓ Confirmado
                                              </span>
                                            ) : (
                                              <span className="text-xs font-semibold text-blue-700">
                                                Pago por confirmar
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {item.paid && (
                                          <div className="mt-3 rounded-xl bg-white border border-slate-200 p-3">
                                            <p className="text-sm text-slate-700">
                                              Pago registrado:{" "}
                                              {formatearMonto(
                                                item.payment_amount ||
                                                item.amount
                                              )}
                                            </p>

                                            {item.payment_at && (
                                              <p className="text-xs text-slate-500 mt-1">
                                                {formatearFechaHora(
                                                  item.payment_at
                                                )}
                                              </p>
                                            )}
                                          </div>
                                        )}

                                        {item.paid &&
                                          item.payment_evidence_url && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                verComprobanteGastoCompartido(
                                                  item.payment_evidence_url
                                                )
                                              }
                                              className="w-full mt-3 rounded-2xl bg-white border border-slate-300 text-slate-800 py-3 font-semibold"
                                            >
                                              Ver comprobante
                                            </button>
                                          )}

                                        {item.paid &&
                                          !item.payment_confirmed && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                confirmarPagoGastoCompartido(
                                                  expense.id,
                                                  item.user_id
                                                )
                                              }
                                              disabled={
                                                responseLoading === loadingId
                                              }
                                              className="w-full mt-2 rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50"
                                            >
                                              {responseLoading === loadingId
                                                ? "Confirmando..."
                                                : "Confirmar pago recibido"}
                                            </button>
                                          )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ====================================================
            HISTORIAL
        ==================================================== */}

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
                  {historialPrestamos.map((loan) => {
                    const payment = payments.find(
                      (item) => item.loan_id === loan.id
                    );

                    return (
                      <div
                        key={loan.id}
                        className="bg-white rounded-3xl border border-slate-200 p-5"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {loan.lender_id === currentUserId
                                ? `Le prestaste a ${obtenerNombre(
                                  loan.borrower_id
                                )}`
                                : `Te prestó ${obtenerNombre(loan.lender_id)}`}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              {loan.description || "Préstamo"}
                            </p>
                          </div>

                          <p className="font-bold text-slate-900 whitespace-nowrap">
                            {formatearMonto(loan.amount)}
                          </p>
                        </div>

                        <div className="mt-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-sm ${loan.status === "completed"
                                ? "bg-emerald-100 text-emerald-700"
                                : loan.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            {loan.status === "completed"
                              ? "Completado"
                              : loan.status === "rejected"
                                ? "Rechazado"
                                : "Cancelado"}
                          </span>
                        </div>

                        <div className="mt-4 text-sm text-slate-700 space-y-1">
                          <p>Registrado: {formatearFecha(loan.created_at)}</p>

                          <p>Fecha límite: {formatearFecha(loan.due_date)}</p>
                        </div>

                        {payment && (
                          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="font-semibold text-slate-900">
                              Información del pago
                            </p>

                            <div className="mt-2 text-sm text-slate-700 space-y-1">
                              <p>Pagado por: {obtenerNombre(payment.paid_by)}</p>

                              <p>
                                Monto pagado: {formatearMonto(payment.amount)}
                              </p>

                              <p>
                                Fecha del pago:{" "}
                                {formatearFechaHora(payment.created_at)}
                              </p>

                              <p>
                                Recepción:{" "}
                                {payment.receiver_confirmed
                                  ? "Confirmada"
                                  : "Pendiente"}
                              </p>
                            </div>

                            {payment.evidence_url && (
                              <button
                                onClick={() =>
                                  verComprobante(payment.evidence_url)
                                }
                                className="w-full mt-4 rounded-2xl bg-slate-900 text-white py-3 font-semibold"
                              >
                                Ver comprobante
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                  <p className="text-slate-700">No hay gastos terminados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historialGastos.map((expense) => {
                    const participants = sharedParticipants.filter(
                      (item) => item.expense_id === expense.id
                    );

                    const miParticipacion = participants.find(
                      (item) => item.user_id === currentUserId
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
                              Total: {formatearMonto(expense.total_amount)}
                            </p>

                            <p className="text-sm text-slate-700 mt-1">
                              Pagó el total: {obtenerNombre(expense.created_by)}
                            </p>
                          </div>

                          <span
                            className={`inline-flex h-fit rounded-full px-3 py-1 text-sm ${expense.status === "completed"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {expense.status === "completed"
                              ? "Completado"
                              : "Cancelado"}
                          </span>
                        </div>

                        {miParticipacion && (
                          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="font-semibold text-slate-900">
                              Tu parte
                            </p>

                            <p className="text-xl font-bold text-slate-900 mt-1">
                              {formatearMonto(miParticipacion.amount)}
                            </p>

                            {miParticipacion.paid && (
                              <p className="text-sm text-emerald-700 mt-2">
                                ✓ Pago registrado
                              </p>
                            )}

                            {miParticipacion.payment_confirmed && (
                              <p className="text-sm text-emerald-700 mt-1">
                                ✓ Pago confirmado
                              </p>
                            )}

                            {miParticipacion.payment_evidence_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  verComprobanteGastoCompartido(
                                    miParticipacion.payment_evidence_url
                                  )
                                }
                                className="w-full mt-3 rounded-2xl bg-slate-900 text-white py-3 font-semibold"
                              >
                                Ver comprobante
                              </button>
                            )}
                          </div>
                        )}

                        {participants.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-semibold text-slate-900 mb-2">
                              Participantes
                            </p>

                            <div className="space-y-2">
                              {participants.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                                >
                                  <div className="flex justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-slate-900">
                                        {obtenerNombre(item.user_id)}
                                      </p>

                                      <p className="text-sm text-slate-600 mt-1">
                                        Parte: {formatearMonto(item.amount)}
                                      </p>
                                    </div>

                                    <div className="text-right">
                                      {item.payment_confirmed ? (
                                        <span className="text-xs font-semibold text-emerald-700">
                                          ✓ Confirmado
                                        </span>
                                      ) : item.paid ? (
                                        <span className="text-xs font-semibold text-blue-700">
                                          Pagó
                                        </span>
                                      ) : item.accepted ? (
                                        <span className="text-xs font-semibold text-red-700">
                                          Falta pagar
                                        </span>
                                      ) : (
                                        <span className="text-xs font-semibold text-amber-700">
                                          No aceptó
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {item.payment_evidence_url && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        verComprobanteGastoCompartido(
                                          item.payment_evidence_url
                                        )
                                      }
                                      className="w-full mt-3 rounded-xl bg-white border border-slate-300 text-slate-800 py-2.5 text-sm font-semibold"
                                    >
                                      Ver comprobante
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ======================================================
          NAVEGACIÓN
      ====================================================== */}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
        <div className="max-w-xl mx-auto grid grid-cols-3">
          <button
            onClick={() => setActiveTab("prestamos")}
            className={`py-4 text-sm font-semibold ${activeTab === "prestamos" ? "text-slate-900" : "text-slate-500"
              }`}
          >
            <div className="text-xl">💸</div>
            Préstamos
          </button>

          <button
            onClick={() => setActiveTab("gastos")}
            className={`py-4 text-sm font-semibold ${activeTab === "gastos" ? "text-slate-900" : "text-slate-500"
              }`}
          >
            <div className="text-xl">🍽️</div>
            Gastos
          </button>

          <button
            onClick={() => setActiveTab("historial")}
            className={`py-4 text-sm font-semibold ${activeTab === "historial" ? "text-slate-900" : "text-slate-500"
              }`}
          >
            <div className="text-xl">📋</div>
            Historial
          </button>
        </div>
      </nav>

      {/* ======================================================
          MODAL GENERAL
      ====================================================== */}

      {modal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-5">
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

            <h3 className="text-xl font-bold text-slate-900">{modal.title}</h3>

            <p className="text-slate-700 mt-2">{modal.message}</p>

            <button
              onClick={cerrarModal}
              className="w-full mt-5 rounded-2xl bg-slate-900 text-white py-3 font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          MODAL CONFIRMAR ELIMINAR GASTO
      ====================================================== */}

      {expenseToDelete && (
        <div className="fixed inset-0 z-[55] bg-black/40 flex items-center justify-center px-5">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900">
              ¿Eliminar gasto?
            </h3>

            <p className="text-slate-700 mt-2">
              Se eliminará "{expenseToDelete.title}" y las solicitudes de los
              participantes. Esta acción no se puede deshacer.
            </p>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                onClick={() => setExpenseToDelete(null)}
                disabled={deleteLoading}
                className="rounded-2xl bg-slate-100 text-slate-700 py-3 font-semibold"
              >
                Cancelar
              </button>

              <button
                onClick={confirmarEliminarGasto}
                disabled={deleteLoading}
                className="rounded-2xl bg-red-600 text-white py-3 font-semibold disabled:opacity-50"
              >
                {deleteLoading ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          MODAL REGISTRAR PAGO PRÉSTAMO
      ====================================================== */}

      {paymentLoan && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900">Registrar pago</h3>

            <p className="text-sm text-slate-700 mt-1">
              Pago de {formatearMonto(paymentLoan.amount)} a{" "}
              {obtenerNombre(paymentLoan.lender_id)}
            </p>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Comprobante del pago
              </label>

              <input
                id="payment-file"
                type="file"
                accept="image/*,application/pdf"
                multiple={false}
                onChange={seleccionarComprobante}
                className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
              />

              {paymentFile ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {paymentFile.type.startsWith("image/")
                        ? "🖼️"
                        : paymentFile.type === "application/pdf"
                          ? "📄"
                          : "📎"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-emerald-900">
                        Archivo seleccionado
                      </p>

                      <p className="mt-1 break-all text-sm text-emerald-800">
                        {paymentFile.name}
                      </p>

                      <p className="mt-1 text-xs text-emerald-700">
                        {(paymentFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentFile(null);

                        const input = document.getElementById(
                          "payment-file"
                        ) as HTMLInputElement | null;

                        if (input) {
                          input.value = "";
                        }
                      }}
                      className="min-h-[40px] min-w-[40px] rounded-lg bg-white px-3 text-sm font-semibold text-red-600 shadow-sm"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Puedes seleccionar una foto desde tu galería, tomar una foto o
                  elegir un PDF.
                </p>
              )}
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
                {paymentSending ? "Guardando..." : "Registrar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          MODAL REGISTRAR PAGO GASTO COMPARTIDO
      ====================================================== */}

      {sharedPaymentExpense && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900">Registrar pago</h3>

            <p className="text-sm text-slate-700 mt-1">
              {sharedPaymentExpense.title}
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Tu parte</p>

              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatearMonto(sharedPaymentAmount)}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Comprobante del pago
              </label>

              <input
                id="shared-payment-file"
                type="file"
                accept="image/*,application/pdf"
                multiple={false}
                onChange={seleccionarComprobanteGasto}
                className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
              />

              {sharedPaymentFile ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {sharedPaymentFile.type.startsWith("image/")
                        ? "🖼️"
                        : sharedPaymentFile.type === "application/pdf"
                          ? "📄"
                          : "📎"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-emerald-900">
                        Archivo seleccionado
                      </p>

                      <p className="mt-1 break-all text-sm text-emerald-800">
                        {sharedPaymentFile.name}
                      </p>

                      <p className="mt-1 text-xs text-emerald-700">
                        {(sharedPaymentFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSharedPaymentFile(null);

                        const input = document.getElementById(
                          "shared-payment-file"
                        ) as HTMLInputElement | null;

                        if (input) {
                          input.value = "";
                        }
                      }}
                      className="min-h-[40px] min-w-[40px] rounded-lg bg-white px-3 text-sm font-semibold text-red-600 shadow-sm"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Puedes seleccionar una foto desde tu galería, tomar una foto o
                  elegir un PDF.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-6">
              <button
                type="button"
                onClick={cerrarPagoGastoCompartido}
                disabled={sharedPaymentSending}
                className="rounded-2xl bg-slate-100 text-slate-700 py-3 font-semibold"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={registrarPagoGastoCompartido}
                disabled={sharedPaymentSending}
                className="rounded-2xl bg-slate-900 text-white py-3 font-semibold disabled:opacity-50"
              >
                {sharedPaymentSending ? "Guardando..." : "Registrar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}