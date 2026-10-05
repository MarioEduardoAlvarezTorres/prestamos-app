"use client";

import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
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
};

type ModalData = {
  title: string;
  message: string;
  type: "success" | "error" | "info";
};

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [users, setUsers] = useState<Profile[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [paymentSending, setPaymentSending] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [responseLoading, setResponseLoading] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    setEmail(session.user.email ?? null);
    setCurrentUserId(session.user.id);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("is_active", true)
      .neq("id", session.user.id);

    if (profilesError) {
      console.error(profilesError);
    } else {
      setUsers(profiles ?? []);
    }

    const { data: loanData, error: loansError } = await supabase
      .from("loans")
      .select(
        "id, lender_id, borrower_id, amount, description, due_date, status, created_at"
      )
      .in("status", ["pending", "active", "payment_pending"])
      .or(
        `lender_id.eq.${session.user.id},borrower_id.eq.${session.user.id}`
      )
      .order("created_at", { ascending: false });

    if (loansError) {
      console.error(loansError);
    } else {
      setLoans(loanData ?? []);
    }

    const { data: paymentData, error: paymentsError } = await supabase
      .from("loan_payments")
      .select(
        "id, loan_id, paid_by, amount, evidence_url, payer_confirmed, receiver_confirmed"
      );

    if (paymentsError) {
      console.error(paymentsError);
    } else {
      setPayments(paymentData ?? []);
    }

    setLoading(false);
  }

  async function confirmarRecepcion(loanId: string) {
  setResponseLoading(loanId);

  const supabase = createClient();

  const { error } = await supabase.rpc("confirmar_recepcion_pago", {
    p_loan_id: loanId,
  });

  if (error) {
    console.error(error);
    mostrarModal("No se pudo confirmar", error.message, "error");
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

  async function loginWithGoogle() {
    setLoginLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error(error);

      mostrarModal(
        "No se pudo iniciar sesión",
        error.message,
        "error"
      );

      setLoginLoading(false);
    }
  }

  async function solicitarPrestamo() {
    if (!selectedUser || !amount) {
      mostrarModal(
        "Faltan datos",
        "Selecciona una persona e indica la cantidad.",
        "info"
      );
      return;
    }

    const numericAmount = Number(amount);

    if (numericAmount <= 0) {
      mostrarModal(
        "Cantidad inválida",
        "La cantidad debe ser mayor que cero.",
        "info"
      );
      return;
    }

    setSending(true);

    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      mostrarModal(
        "Sesión expirada",
        "Vuelve a iniciar sesión para continuar.",
        "error"
      );

      setSending(false);
      return;
    }

    const { data, error } = await supabase
      .from("loans")
      .insert({
        lender_id: selectedUser.id,
        borrower_id: session.user.id,
        amount: numericAmount,
        description: description || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error(error);

      mostrarModal(
        "No se pudo crear",
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
        user_id: session.user.id,
        accepted: true,
        accepted_at: new Date().toISOString(),
      });

    if (acceptanceError) {
      console.error(acceptanceError);

      mostrarModal(
        "Solicitud creada",
        "La solicitud se creó, pero hubo un problema registrando tu aceptación.",
        "error"
      );

      setSending(false);
      return;
    }

    setSelectedUser(null);
    setAmount("");
    setDescription("");

    await loadData();

    mostrarModal(
      "Solicitud enviada",
      `Tu solicitud de $${numericAmount.toFixed(
        2
      )} fue enviada correctamente a ${selectedUser.full_name || selectedUser.email || "la otra persona"
      }.`,
      "success"
    );

    setSending(false);
  }

  async function responderSolicitud(
    loanId: string,
    aceptar: boolean
  ) {
    setResponseLoading(loanId);

    const supabase = createClient();

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
        "No se pudo responder",
        error.message,
        "error"
      );

      setResponseLoading(null);
      return;
    }

    await loadData();

    mostrarModal(
      aceptar ? "Solicitud aceptada" : "Solicitud rechazada",
      aceptar
        ? "La solicitud fue aceptada. El préstamo ya puede pasar a estado activo."
        : "La solicitud fue rechazada.",
      aceptar ? "success" : "info"
    );

    setResponseLoading(null);
  }

  function obtenerNombre(userId: string) {
    const user = users.find((item) => item.id === userId);

    return user?.full_name || user?.email || "Usuario";
  }

  function obtenerPago(loanId: string) {
    return payments.find(
      (payment) => payment.loan_id === loanId
    );
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
    if (!paymentLoan || !paymentFile || !currentUserId) {
      mostrarModal(
        "Falta el comprobante",
        "Selecciona el comprobante del pago antes de continuar.",
        "info"
      );
      return;
    }

    const numericAmount = Number(paymentAmount);

    if (numericAmount <= 0) {
      mostrarModal(
        "Cantidad inválida",
        "La cantidad pagada debe ser mayor que cero.",
        "info"
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
        "El comprobante debe ser JPG, PNG, WEBP o PDF.",
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

    setPaymentSending(true);

    const supabase = createClient();

    const extension =
      paymentFile.name.split(".").pop()?.toLowerCase() || "file";

    const filePath = `${currentUserId}/${paymentLoan.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-evidence")
      .upload(filePath, paymentFile);

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
        amount: numericAmount,
        evidence_url: filePath,
        payer_confirmed: true,
        receiver_confirmed: false,
      });

    if (paymentError) {
      console.error(paymentError);

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
        "El pago se registró, pero hubo un problema actualizando el estado del préstamo.",
        "error"
      );

      setPaymentSending(false);
      return;
    }

    cerrarRegistroPago();

    await loadData();

    mostrarModal(
      "Pago registrado",
      "El comprobante se guardó correctamente. Ahora la otra persona debe confirmar que recibió el pago.",
      "success"
    );

    setPaymentSending(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-5 text-slate-900">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="font-medium text-slate-800">
              Cargando...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="min-h-screen bg-slate-100 p-5 text-slate-900">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
          <div className="w-full rounded-3xl bg-white p-7 shadow-lg">
            <h1 className="text-3xl font-bold text-slate-950">
              Préstamos
            </h1>

            <p className="mt-3 leading-6 text-slate-600">
              Administra tus préstamos de forma sencilla y
              ordenada.
            </p>

            <button
              onClick={loginWithGoogle}
              disabled={loginLoading}
              className="mt-8 w-full rounded-2xl bg-slate-950 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loginLoading
                ? "Conectando..."
                : "Continuar con Google"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const pendingRequests = loans.filter(
    (loan) =>
      loan.status === "pending" &&
      loan.lender_id === currentUserId
  );

  const myLoans = loans.filter(
    (loan) => loan.status === "active"
  );

  const paymentPendingLoans = loans.filter(
    (loan) => loan.status === "payment_pending"
  );

  return (
    <main className="min-h-screen bg-slate-100 p-4 pb-10 text-slate-900">
      <div className="mx-auto max-w-md space-y-5">

        {/* ENCABEZADO */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Sesión iniciada como
          </p>

          <h1 className="mt-1 break-all text-lg font-bold text-slate-950">
            {email}
          </h1>

          <p className="mt-3 text-sm leading-5 text-slate-600">
            Aquí puedes consultar lo que debes y lo que te deben.
          </p>
        </section>

        {/* SOLICITUDES PENDIENTES */}
        {pendingRequests.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">
                Solicitudes pendientes
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Tienes solicitudes que necesitan tu respuesta.
              </p>
            </div>

            <div className="space-y-4">
              {pendingRequests.map((loan) => (
                <div
                  key={loan.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm font-medium text-slate-500">
                    Te solicita un préstamo
                  </p>

                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {obtenerNombre(loan.borrower_id)}
                  </p>

                  <p className="mt-3 text-3xl font-bold text-slate-950">
                    ${loan.amount.toFixed(2)}
                  </p>

                  {loan.description && (
                    <p className="mt-2 text-sm leading-5 text-slate-600">
                      {loan.description}
                    </p>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      onClick={() =>
                        responderSolicitud(loan.id, false)
                      }
                      disabled={responseLoading === loan.id}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 disabled:opacity-50"
                    >
                      Rechazar
                    </button>

                    <button
                      onClick={() =>
                        responderSolicitud(loan.id, true)
                      }
                      disabled={responseLoading === loan.id}
                      className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      {responseLoading === loan.id
                        ? "Guardando..."
                        : "Aceptar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* MIS PRÉSTAMOS */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Mis préstamos
            </h2>

            <p className="mt-1 text-sm leading-5 text-slate-600">
              Aquí ves claramente quién debe y quién recibe.
            </p>
          </div>

          {myLoans.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-center">
              <p className="font-medium text-slate-700">
                No tienes préstamos activos.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {myLoans.map((loan) => {
                const yoPreste = loan.lender_id === currentUserId;
                const otraPersona = yoPreste
                  ? obtenerNombre(loan.borrower_id)
                  : obtenerNombre(loan.lender_id);

                return (
                  <div
                    key={loan.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {yoPreste
                            ? "Tú prestaste"
                            : "Tú recibiste"}
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-950">
                          {yoPreste
                            ? `A ${otraPersona}`
                            : `De ${otraPersona}`}
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        Activo
                      </span>
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-100 p-4">
                      <p className="text-sm font-semibold text-slate-600">
                        {yoPreste
                          ? `${otraPersona} te debe`
                          : `Le debes a ${otraPersona}`}
                      </p>

                      <p className="mt-1 text-3xl font-bold text-slate-950">
                        ${loan.amount.toFixed(2)}
                      </p>
                    </div>

                    {loan.description && (
                      <p className="mt-3 text-sm leading-5 text-slate-600">
                        {loan.description}
                      </p>
                    )}

                    {!yoPreste && (
                      <button
                        onClick={() =>
                          abrirRegistroPago(loan)
                        }
                        className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
                      >
                        Registrar pago
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* PAGOS PENDIENTES */}
        {paymentPendingLoans.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">
              Pagos pendientes
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Hay pagos esperando confirmación.
            </p>

            <div className="mt-5 space-y-4">
              {paymentPendingLoans.map((loan) => {
                const payment = obtenerPago(loan.id);
                const yoPreste = loan.lender_id === currentUserId;
                const otraPersona = yoPreste
                  ? obtenerNombre(loan.borrower_id)
                  : obtenerNombre(loan.lender_id);

                return (
                  <div
                    key={loan.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
                  >
                    <p className="text-sm font-semibold text-amber-800">
                      Pago pendiente
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {yoPreste
                        ? `${otraPersona} te pagó`
                        : `Pagaste a ${otraPersona}`}
                    </p>

                    <p className="mt-3 text-3xl font-bold text-slate-950">
                      ${(payment?.amount ?? loan.amount).toFixed(2)}
                    </p>

                    {yoPreste ? (
                      <button
                        onClick={() => confirmarRecepcion(loan.id)}
                        disabled={responseLoading === loan.id}
                        className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
                      >
                        Confirmar recepción
                      </button>
                    ) : (
                      <p className="mt-4 text-sm font-medium leading-5 text-slate-600">
                        El pago está registrado. Esperando que
                        la otra persona confirme la recepción.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SOLICITAR PRÉSTAMO */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">
            Solicitar préstamo
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            El préstamo quedará activo cuando la otra persona
            lo acepte.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                ¿A quién?
              </label>

              <select
                value={selectedUser?.id ?? ""}
                onChange={(e) => {
                  const user = users.find(
                    (item) => item.id === e.target.value
                  );

                  setSelectedUser(user ?? null);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-slate-600"
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
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Cantidad
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
                placeholder="Ej. 500"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Descripción
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="¿Para qué es el préstamo?"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-600"
              />
            </div>

            <button
              onClick={solicitarPrestamo}
              disabled={sending}
              className="w-full rounded-xl bg-slate-950 px-5 py-4 font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {sending
                ? "Enviando..."
                : "Enviar solicitud"}
            </button>
          </div>
        </section>
      </div>

      {/* MODAL DE PAGO */}
      {paymentLoan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Registrar pago
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Estás registrando un pago de este préstamo.
                </p>
              </div>

              <button
                onClick={cerrarRegistroPago}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-100 p-4">
              <p className="text-sm font-medium text-slate-600">
                Pago a {obtenerNombre(paymentLoan.lender_id)}
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                ${paymentLoan.amount.toFixed(2)}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Cantidad pagada
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
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
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800"
                />

                <p className="mt-2 text-xs text-slate-500">
                  JPG, PNG, WEBP o PDF · Máximo 5 MB
                </p>
              </div>

              <button
                onClick={registrarPago}
                disabled={paymentSending}
                className="w-full rounded-xl bg-slate-950 px-5 py-4 font-semibold text-white disabled:opacity-50"
              >
                {paymentSending
                  ? "Guardando..."
                  : "Guardar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GENERAL */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-5">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${modal.type === "success"
                ? "bg-emerald-100 text-emerald-700"
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

            <h2 className="mt-5 text-xl font-bold text-slate-950">
              {modal.title}
            </h2>

            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
              {modal.message}
            </p>

            <button
              onClick={cerrarModal}
              className="mt-6 w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}