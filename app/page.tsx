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
      alert(error.message);
      setLoginLoading(false);
    }
  }

  async function solicitarPrestamo() {
    if (!selectedUser || !amount) {
      alert("Selecciona una persona e indica la cantidad.");
      return;
    }

    const numericAmount = Number(amount);

    if (numericAmount <= 0) {
      alert("La cantidad debe ser mayor que 0.");
      return;
    }

    setSending(true);

    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert("Tu sesión ha expirado.");
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
      alert("No se pudo crear la solicitud: " + error.message);
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
      alert(
        "El préstamo se creó, pero hubo un problema registrando la aceptación."
      );
      setSending(false);
      return;
    }

    alert("¡Solicitud enviada!");

    setSelectedUser(null);
    setAmount("");
    setDescription("");

    await loadData();

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
      alert("No se pudo responder la solicitud: " + error.message);
      setResponseLoading(null);
      return;
    }

    alert(
      aceptar
        ? "¡Solicitud aceptada!"
        : "Solicitud rechazada."
    );

    await loadData();

    setResponseLoading(null);
  }

  function obtenerNombreContraparte(loan: Loan) {
    if (loan.lender_id === currentUserId) {
      const borrower = users.find(
        (user) => user.id === loan.borrower_id
      );

      return borrower?.full_name || borrower?.email || "Usuario";
    }

    const lender = users.find(
      (user) => user.id === loan.lender_id
    );

    return lender?.full_name || lender?.email || "Usuario";
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
      alert("Selecciona el comprobante de pago.");
      return;
    }

    const numericAmount = Number(paymentAmount);

    if (numericAmount <= 0) {
      alert("La cantidad debe ser mayor que 0.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(paymentFile.type)) {
      alert("El comprobante debe ser JPG, PNG, WEBP o PDF.");
      return;
    }

    if (paymentFile.size > 5 * 1024 * 1024) {
      alert("El comprobante no puede superar 5 MB.");
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
      alert(
        "No se pudo subir el comprobante: " +
          uploadError.message
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
      alert(
        "El comprobante se subió, pero no se pudo registrar el pago: " +
          paymentError.message
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
      alert(
        "El pago se registró, pero no se pudo actualizar el préstamo."
      );
      setPaymentSending(false);
      return;
    }

    alert(
      "¡Pago registrado! La otra persona debe confirmar que recibió el pago."
    );

    cerrarRegistroPago();

    await loadData();

    setPaymentSending(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl bg-white p-6 shadow">
            Cargando...
          </div>
        </div>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
          <div className="w-full rounded-3xl bg-white p-7 shadow-lg">
            <h1 className="text-3xl font-bold text-gray-900">
              Préstamos
            </h1>

            <p className="mt-3 text-gray-600">
              Una aplicación privada para administrar préstamos
              entre personas.
            </p>

            <button
              onClick={loginWithGoogle}
              disabled={loginLoading}
              className="mt-8 w-full rounded-xl bg-black px-5 py-4 font-semibold text-white disabled:opacity-50"
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
    <main className="min-h-screen bg-gray-100 p-4 pb-10">
      <div className="mx-auto max-w-md space-y-5">

        {/* ENCABEZADO */}
        <section className="rounded-3xl bg-white p-6 shadow">
          <p className="text-sm text-gray-500">
            Sesión iniciada como
          </p>

          <h1 className="mt-1 text-xl font-bold text-gray-900">
            {email}
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            Administra tus préstamos de forma sencilla.
          </p>
        </section>

        {/* SOLICITUDES PENDIENTES */}
        {pendingRequests.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Solicitudes pendientes
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Estas personas te han solicitado un préstamo.
              </p>
            </div>

            <div className="space-y-4">
              {pendingRequests.map((loan) => (
                <div
                  key={loan.id}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <p className="font-semibold text-gray-900">
                    {obtenerNombreContraparte(loan)}
                  </p>

                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    ${loan.amount.toFixed(2)}
                  </p>

                  {loan.description && (
                    <p className="mt-2 text-sm text-gray-600">
                      {loan.description}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() =>
                        responderSolicitud(loan.id, false)
                      }
                      disabled={responseLoading === loan.id}
                      className="rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 disabled:opacity-50"
                    >
                      Rechazar
                    </button>

                    <button
                      onClick={() =>
                        responderSolicitud(loan.id, true)
                      }
                      disabled={responseLoading === loan.id}
                      className="rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50"
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

        {/* PRÉSTAMOS ACTIVOS */}
        <section className="rounded-3xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-gray-900">
            Mis préstamos
          </h2>

          {myLoans.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              No tienes préstamos activos.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {myLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">
                      {obtenerNombreContraparte(loan)}
                    </p>

                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      Activo
                    </span>
                  </div>

                  <p className="mt-3 text-2xl font-bold">
                    ${loan.amount.toFixed(2)}
                  </p>

                  {loan.description && (
                    <p className="mt-2 text-sm text-gray-600">
                      {loan.description}
                    </p>
                  )}

                  {loan.borrower_id === currentUserId && (
                    <button
                      onClick={() =>
                        abrirRegistroPago(loan)
                      }
                      className="mt-4 w-full rounded-xl bg-black px-4 py-3 font-semibold text-white"
                    >
                      Registrar pago
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PAGOS PENDIENTES DE CONFIRMACIÓN */}
        {paymentPendingLoans.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-gray-900">
              Pagos pendientes
            </h2>

            <div className="mt-4 space-y-4">
              {paymentPendingLoans.map((loan) => {
                const payment = obtenerPago(loan.id);

                return (
                  <div
                    key={loan.id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {obtenerNombreContraparte(loan)}
                      </p>

                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                        Pendiente
                      </span>
                    </div>

                    <p className="mt-3 text-2xl font-bold">
                      $
                      {(
                        payment?.amount ?? loan.amount
                      ).toFixed(2)}
                    </p>

                    {loan.lender_id === currentUserId && (
                      <button
                        onClick={() =>
                          alert(
                            "La confirmación de recepción se implementará en el siguiente paso."
                          )
                        }
                        className="mt-4 w-full rounded-xl bg-black px-4 py-3 font-semibold text-white"
                      >
                        Confirmar recepción
                      </button>
                    )}

                    {loan.borrower_id === currentUserId && (
                      <p className="mt-4 text-sm text-gray-500">
                        Esperando que la otra persona confirme
                        la recepción.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SOLICITAR PRÉSTAMO */}
        <section className="rounded-3xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-gray-900">
            Solicitar préstamo
          </h2>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
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
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
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
              <label className="mb-2 block text-sm font-medium text-gray-700">
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Descripción
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="¿Para qué es el préstamo?"
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            <button
              onClick={solicitarPrestamo}
              disabled={sending}
              className="w-full rounded-xl bg-black px-5 py-4 font-semibold text-white disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Registrar pago
              </h2>

              <button
                onClick={cerrarRegistroPago}
                className="text-2xl text-gray-400"
              >
                ×
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Préstamo con {obtenerNombreContraparte(paymentLoan)}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
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
                  className="w-full rounded-xl border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
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
                  className="w-full text-sm"
                />

                <p className="mt-2 text-xs text-gray-500">
                  JPG, PNG, WEBP o PDF. Máximo 5 MB.
                </p>
              </div>

              <button
                onClick={registrarPago}
                disabled={paymentSending}
                className="w-full rounded-xl bg-black px-5 py-4 font-semibold text-white disabled:opacity-50"
              >
                {paymentSending
                  ? "Registrando..."
                  : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}