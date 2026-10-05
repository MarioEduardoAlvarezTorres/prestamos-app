"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

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
  due_date: string;
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

type ModalData = {
  title: string;
  message: string;
  type: "success" | "error" | "info";
};

export default function Home() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [users, setUsers] = useState<Profile[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [selectedUser, setSelectedUser] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [paymentSending, setPaymentSending] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [responseLoading, setResponseLoading] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalData | null>(null);

  const [activeTab, setActiveTab] = useState<"inicio" | "historial">(
    "inicio"
  );

  useEffect(() => {
    loadData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadData();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadData() {
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

    setCurrentUserId(session.user.id);
    setEmail(session.user.email ?? "");

    const { data: profiles } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, avatar_url, is_admin, is_active"
      )
      .eq("is_active", true)
      .neq("id", session.user.id)
      .order("full_name");

    setUsers(profiles ?? []);

    const { data: loanData, error: loanError } = await supabase
      .from("loans")
      .select(
        "id, lender_id, borrower_id, amount, description, due_date, status, created_at, updated_at"
      )
      .or(
        `borrower_id.eq.${session.user.id},lender_id.eq.${session.user.id}`
      )
      .in("status", [
        "pending",
        "active",
        "payment_pending",
        "completed",
        "rejected",
        "cancelled",
      ])
      .order("created_at", { ascending: false });

    if (loanError) {
      console.error(loanError);
    }

    setLoans(loanData ?? []);

    const { data: paymentData, error: paymentError } = await supabase
      .from("loan_payments")
      .select(
        "id, loan_id, paid_by, amount, evidence_url, payer_confirmed, receiver_confirmed, created_at"
      )
      .order("created_at", { ascending: false });

    if (paymentError) {
      console.error(paymentError);
    }

    setPayments(paymentData ?? []);

    setLoading(false);
  }

  async function loginWithGoogle() {
    setLoginLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error(error);
      mostrarModal("No se pudo iniciar sesión", error.message, "error");
      setLoginLoading(false);
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setCurrentUserId(null);
    setEmail("");
    setLoans([]);
    setPayments([]);
    setUsers([]);
  }

  function mostrarModal(
    title: string,
    message: string,
    type: "success" | "error" | "info"
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

  async function solicitarPrestamo() {
    if (!currentUserId) return;

    if (!selectedUser) {
      mostrarModal(
        "Falta seleccionar una persona",
        "Selecciona a quién quieres solicitar el préstamo.",
        "error"
      );
      return;
    }

    if (!amount || Number(amount) <= 0) {
      mostrarModal(
        "Monto inválido",
        "Escribe un monto mayor a cero.",
        "error"
      );
      return;
    }

    if (!dueDate) {
      mostrarModal(
        "Falta la fecha límite",
        "Selecciona una fecha límite para el préstamo.",
        "error"
      );
      return;
    }

    setSending(true);

    const { data, error } = await supabase
      .from("loans")
      .insert({
        lender_id: selectedUser,
        borrower_id: currentUserId,
        amount: Number(amount),
        description: description.trim() || null,
        due_date: dueDate,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      mostrarModal(
        "No se pudo crear el préstamo",
        error.message,
        "error"
      );
      setSending(false);
      return;
    }

    const { error: acceptanceError } = await supabase
      .from("loan_acceptances")
      .insert({
        loan_id: data.id,
        user_id: currentUserId,
        accepted: true,
        accepted_at: new Date().toISOString(),
      });

    if (acceptanceError) {
      console.error(acceptanceError);
      mostrarModal(
        "Préstamo creado",
        "El préstamo se creó, pero hubo un problema registrando tu aceptación.",
        "error"
      );
      setSending(false);
      await loadData();
      return;
    }

    setSelectedUser("");
    setAmount("");
    setDescription("");
    setDueDate("");

    await loadData();

    mostrarModal(
      "Solicitud enviada",
      "La solicitud quedó pendiente de aceptación.",
      "success"
    );

    setSending(false);
  }

  async function responderSolicitud(
    loanId: string,
    aceptar: boolean
  ) {
    setResponseLoading(loanId);

    const { error } = await supabase.rpc(
      "responder_solicitud_prestamo",
      {
        p_loan_id: loanId,
        p_aceptar: aceptar,
      }
    );

    if (error) {
      console.error(error);
      mostrarModal(
        aceptar ? "No se pudo aceptar" : "No se pudo rechazar",
        error.message,
        "error"
      );
      setResponseLoading(null);
      return;
    }

    await loadData();

    mostrarModal(
      aceptar ? "Préstamo aceptado" : "Solicitud rechazada",
      aceptar
        ? "El préstamo quedó activo."
        : "La solicitud fue rechazada.",
      "success"
    );

    setResponseLoading(null);
  }

  function obtenerNombre(userId: string) {
    if (userId === currentUserId) {
      return "Tú";
    }

    const user = users.find((item) => item.id === userId);

    return user?.full_name || user?.email || "Usuario";
  }

  function obtenerPago(loanId: string) {
    return payments.find((payment) => payment.loan_id === loanId);
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

  async function registrarPago() {
    if (!currentUserId || !paymentLoan) return;

    if (!paymentFile) {
      mostrarModal(
        "Falta el comprobante",
        "Selecciona una imagen o PDF como comprobante.",
        "error"
      );
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(paymentFile.type)) {
      mostrarModal(
        "Archivo no válido",
        "Puedes subir JPG, PNG, WEBP o PDF.",
        "error"
      );
      return;
    }

    if (paymentFile.size > 5 * 1024 * 1024) {
      mostrarModal(
        "Archivo demasiado grande",
        "El comprobante no puede superar los 5 MB.",
        "error"
      );
      return;
    }

    if (
      !paymentAmount ||
      Number(paymentAmount) <= 0
    ) {
      mostrarModal(
        "Monto inválido",
        "Escribe un monto válido.",
        "error"
      );
      return;
    }

    setPaymentSending(true);

    const extension =
      paymentFile.name.split(".").pop()?.toLowerCase() || "file";

    const filePath = `${currentUserId}/${paymentLoan.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-evidence")
      .upload(filePath, paymentFile, {
        contentType: paymentFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);
      mostrarModal(
        "No se pudo subir el comprobante",
        uploadError.message,
        "error"
      );
      setPaymentSending(false);
      return;
    }

    const { error: paymentError } = await supabase
      .from("loan_payments")
      .insert({
        loan_id: paymentLoan.id,
        paid_by: currentUserId,
        amount: Number(paymentAmount),
        evidence_url: filePath,
        payer_confirmed: true,
        receiver_confirmed: false,
      });

    if (paymentError) {
      console.error(paymentError);

      await supabase.storage
        .from("payment-evidence")
        .remove([filePath]);

      mostrarModal(
        "No se pudo registrar el pago",
        paymentError.message,
        "error"
      );

      setPaymentSending(false);
      return;
    }

    const { error: loanError } = await supabase
      .from("loans")
      .update({
        status: "payment_pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentLoan.id);

    if (loanError) {
      console.error(loanError);
      mostrarModal(
        "Pago registrado",
        "El comprobante se subió, pero hubo un problema actualizando el préstamo.",
        "error"
      );
      setPaymentSending(false);
      await loadData();
      cerrarRegistroPago();
      return;
    }

    await loadData();
    cerrarRegistroPago();

    mostrarModal(
      "Pago registrado",
      "El comprobante fue enviado. La otra persona debe confirmar la recepción.",
      "success"
    );

    setPaymentSending(false);
  }

  async function confirmarRecepcion(loanId: string) {
    setResponseLoading(loanId);

    const { error } = await supabase.rpc(
      "confirmar_recepcion_pago",
      {
        p_loan_id: loanId,
      }
    );

    if (error) {
      console.error(error);
      mostrarModal(
        "No se pudo confirmar",
        error.message,
        "error"
      );
      setResponseLoading(null);
      return;
    }

    await loadData();

    mostrarModal(
      "Pago confirmado",
      "La recepción del pago fue confirmada y el préstamo quedó completado.",
      "success"
    );

    setResponseLoading(null);
  }

  const misPrestamos = loans.filter(
    (loan) =>
      loan.status === "active" ||
      loan.status === "payment_pending"
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

  const historial = loans.filter(
    (loan) =>
      loan.status === "completed" ||
      loan.status === "rejected" ||
      loan.status === "cancelled"
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">
            Préstamos
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Cargando...
          </p>
        </div>
      </main>
    );
  }

  if (!currentUserId) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-2xl text-white">
              $
            </div>

            <h1 className="mt-5 text-3xl font-bold text-slate-950">
              Préstamos
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Gestiona préstamos entre las personas de confianza de
              forma sencilla.
            </p>
          </div>

          <button
            onClick={loginWithGoogle}
            disabled={loginLoading}
            className="mt-7 w-full rounded-2xl bg-slate-950 px-5 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loginLoading
              ? "Conectando..."
              : "Continuar con Google"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-400">
            Solo las cuentas autorizadas podrán utilizar la aplicación.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 py-5">
        {/* ENCABEZADO */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Cuenta
            </p>
            <h1 className="text-xl font-bold text-slate-950">
              Préstamos
            </h1>
            <p className="mt-1 max-w-[240px] truncate text-xs text-slate-500">
              {email}
            </p>
          </div>

          <button
            onClick={cerrarSesion}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Salir
          </button>
        </header>

        {/* ==================== INICIO ==================== */}
        {activeTab === "inicio" && (
          <div className="space-y-7">
            {/* NUEVO PRÉSTAMO */}
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Solicitar préstamo
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  La otra persona tendrá que aceptar antes de que
                  el préstamo quede activo.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Solicitar a
                  </label>

                  <select
                    value={selectedUser}
                    onChange={(e) =>
                      setSelectedUser(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
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
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Monto
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Fecha límite
                  </label>

                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Descripción
                  </label>

                  <textarea
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    placeholder="¿Para qué es el préstamo?"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <button
                  onClick={solicitarPrestamo}
                  disabled={sending}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {sending
                    ? "Enviando..."
                    : "Solicitar préstamo"}
                </button>
              </div>
            </section>

            {/* MIS PRÉSTAMOS */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-950">
                  Mis préstamos
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Préstamos que están actualmente activos.
                </p>
              </div>

              {misPrestamos.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  No tienes préstamos activos.
                </div>
              ) : (
                <div className="space-y-4">
                  {misPrestamos.map((loan) => {
                    const soyPrestamista =
                      loan.lender_id === currentUserId;

                    const otraPersona = soyPrestamista
                      ? loan.borrower_id
                      : loan.lender_id;

                    const payment = obtenerPago(loan.id);

                    return (
                      <div
                        key={loan.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {soyPrestamista
                                ? "Tú prestaste"
                                : "Tú recibiste"}
                            </p>

                            <h3 className="mt-1 font-bold text-slate-950">
                              {soyPrestamista
                                ? `A ${obtenerNombre(
                                    otraPersona
                                  )}`
                                : `De ${obtenerNombre(
                                    otraPersona
                                  )}`}
                            </h3>
                          </div>

                          <p className="text-xl font-bold text-slate-950">
                            ${Number(loan.amount).toFixed(2)}
                          </p>
                        </div>

                        <div className="mt-4 rounded-xl bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-800">
                            {soyPrestamista
                              ? `${obtenerNombre(
                                  otraPersona
                                )} te debe`
                              : `Le debes a ${obtenerNombre(
                                  otraPersona
                                )}`}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Fecha límite:{" "}
                            {new Date(
                              loan.due_date
                            ).toLocaleDateString("es-MX")}
                          </p>
                        </div>

                        {loan.description && (
                          <p className="mt-4 text-sm text-slate-600">
                            {loan.description}
                          </p>
                        )}

                        {loan.status === "active" &&
                          !soyPrestamista && (
                            <button
                              onClick={() =>
                                abrirRegistroPago(loan)
                              }
                              className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
                            >
                              Registrar pago
                            </button>
                          )}

                        {loan.status === "payment_pending" &&
                          soyPrestamista && (
                            <div className="mt-5">
                              <div className="rounded-xl bg-amber-50 p-4">
                                <p className="text-sm font-semibold text-amber-800">
                                  Pago pendiente de confirmación
                                </p>

                                <p className="mt-1 text-xs text-amber-700">
                                  {payment
                                    ? `${obtenerNombre(
                                        payment.paid_by
                                      )} registró un pago de $${Number(
                                        payment.amount
                                      ).toFixed(2)}.`
                                    : "Hay un pago pendiente."}
                                </p>
                              </div>

                              <button
                                onClick={() =>
                                  confirmarRecepcion(
                                    loan.id
                                  )
                                }
                                disabled={
                                  responseLoading === loan.id
                                }
                                className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
                              >
                                {responseLoading === loan.id
                                  ? "Confirmando..."
                                  : "Confirmar recepción"}
                              </button>
                            </div>
                          )}

                        {loan.status === "payment_pending" &&
                          !soyPrestamista && (
                            <div className="mt-5 rounded-xl bg-amber-50 p-4">
                              <p className="text-sm font-semibold text-amber-800">
                                Pago enviado
                              </p>

                              <p className="mt-1 text-xs text-amber-700">
                                Esperando que el prestamista confirme
                                la recepción.
                              </p>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SOLICITUDES PENDIENTES */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-950">
                  Solicitudes pendientes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Personas que te están solicitando dinero.
                </p>
              </div>

              {solicitudesPendientes.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  No tienes solicitudes pendientes.
                </div>
              ) : (
                <div className="space-y-4">
                  {solicitudesPendientes.map((loan) => (
                    <div
                      key={loan.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Solicitud de
                          </p>

                          <h3 className="mt-1 font-bold text-slate-950">
                            {obtenerNombre(loan.borrower_id)}
                          </h3>
                        </div>

                        <p className="text-xl font-bold text-slate-950">
                          ${Number(loan.amount).toFixed(2)}
                        </p>
                      </div>

                      {loan.description && (
                        <p className="mt-4 text-sm text-slate-600">
                          {loan.description}
                        </p>
                      )}

                      <p className="mt-3 text-xs text-slate-400">
                        Fecha límite:{" "}
                        {new Date(
                          loan.due_date
                        ).toLocaleDateString("es-MX")}
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3">
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
                          className="rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 disabled:opacity-50"
                        >
                          Rechazar
                        </button>

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
                          className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
                        >
                          {responseLoading === loan.id
                            ? "Procesando..."
                            : "Aceptar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* PAGOS PENDIENTES */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-950">
                  Pagos pendientes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Pagos que necesitan tu confirmación.
                </p>
              </div>

              {pagosPendientes.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  No tienes pagos pendientes.
                </div>
              ) : (
                <div className="space-y-4">
                  {pagosPendientes.map((loan) => {
                    const payment = obtenerPago(loan.id);

                    return (
                      <div
                        key={loan.id}
                        className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                          Pago por confirmar
                        </p>

                        <h3 className="mt-1 font-bold text-slate-950">
                          {obtenerNombre(loan.borrower_id)}
                        </h3>

                        <p className="mt-3 text-2xl font-bold text-slate-950">
                          $
                          {Number(
                            payment?.amount ?? loan.amount
                          ).toFixed(2)}
                        </p>

                        <p className="mt-2 text-sm text-slate-500">
                          Revisa el comprobante y confirma que
                          recibiste el pago.
                        </p>

                        <button
                          onClick={() =>
                            confirmarRecepcion(loan.id)
                          }
                          disabled={
                            responseLoading === loan.id
                          }
                          className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
                        >
                          {responseLoading === loan.id
                            ? "Confirmando..."
                            : "Confirmar recepción"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ==================== HISTORIAL ==================== */}
        {activeTab === "historial" && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-950">
                Historial
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Aquí aparecen los préstamos que ya terminaron.
              </p>
            </div>

            {historial.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                  ✓
                </div>

                <h3 className="mt-4 font-semibold text-slate-900">
                  Sin historial
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Cuando completes o rechaces un préstamo aparecerá
                  aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {historial.map((loan) => {
                  const soyPrestamista =
                    loan.lender_id === currentUserId;

                  const otraPersona = soyPrestamista
                    ? loan.borrower_id
                    : loan.lender_id;

                  return (
                    <div
                      key={loan.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {soyPrestamista
                              ? "Tú prestaste"
                              : "Tú recibiste"}
                          </p>

                          <h3 className="mt-1 font-bold text-slate-950">
                            {soyPrestamista
                              ? `A ${obtenerNombre(
                                  otraPersona
                                )}`
                              : `De ${obtenerNombre(
                                  otraPersona
                                )}`}
                          </h3>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            loan.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {loan.status === "completed"
                            ? "Completado"
                            : loan.status === "rejected"
                            ? "Rechazado"
                            : "Cancelado"}
                        </span>
                      </div>

                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <p className="text-xs text-slate-400">
                            Monto
                          </p>

                          <p className="text-2xl font-bold text-slate-950">
                            ${Number(loan.amount).toFixed(2)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-slate-400">
                            Fecha límite
                          </p>

                          <p className="text-sm font-medium text-slate-700">
                            {new Date(
                              loan.due_date
                            ).toLocaleDateString("es-MX")}
                          </p>
                        </div>
                      </div>

                      {loan.description && (
                        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                          {loan.description}
                        </p>
                      )}

                      <p className="mt-4 text-xs text-slate-400">
                        Creado el{" "}
                        {new Date(
                          loan.created_at
                        ).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* NAVEGACIÓN INFERIOR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-2">
          <button
            onClick={() => setActiveTab("inicio")}
            className={`flex flex-col items-center gap-1 px-4 py-3 text-xs font-semibold ${
              activeTab === "inicio"
                ? "text-slate-950"
                : "text-slate-400"
            }`}
          >
            <span className="text-xl">⌂</span>
            Inicio
          </button>

          <button
            onClick={() => setActiveTab("historial")}
            className={`flex flex-col items-center gap-1 px-4 py-3 text-xs font-semibold ${
              activeTab === "historial"
                ? "text-slate-950"
                : "text-slate-400"
            }`}
          >
            <span className="text-xl">↺</span>
            Historial
          </button>
        </div>
      </nav>

      {/* MODAL GENERAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                modal.type === "success"
                  ? "bg-green-100 text-green-700"
                  : modal.type === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {modal.type === "success"
                ? "✓"
                : modal.type === "error"
                ? "!"
                : "i"}
            </div>

            <h2 className="mt-4 text-center text-xl font-bold text-slate-950">
              {modal.title}
            </h2>

            <p className="mt-2 text-center text-sm leading-6 text-slate-500">
              {modal.message}
            </p>

            <button
              onClick={cerrarModal}
              className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO */}
      {paymentLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Registrar pago
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Deuda con{" "}
                  {obtenerNombre(paymentLoan.lender_id)}
                </p>
              </div>

              <button
                onClick={cerrarRegistroPago}
                className="text-2xl text-slate-400"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Monto del préstamo
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                ${Number(paymentLoan.amount).toFixed(2)}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Monto pagado
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Comprobante
                </label>

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(e) =>
                    setPaymentFile(
                      e.target.files?.[0] ?? null
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                />

                <p className="mt-2 text-xs text-slate-400">
                  JPG, PNG, WEBP o PDF. Máximo 5 MB.
                </p>
              </div>

              <button
                onClick={registrarPago}
                disabled={paymentSending}
                className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {paymentSending
                  ? "Enviando..."
                  : "Enviar comprobante"}
              </button>

              <button
                onClick={cerrarRegistroPago}
                disabled={paymentSending}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}