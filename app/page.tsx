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
  created_at: string;
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

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    setCurrentUserId(userId);
    setEmail(session.user.email ?? null);

    const { data: usersData, error: usersError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("is_active", true)
      .neq("id", userId);

    if (usersError) {
      console.error("Error cargando usuarios:", usersError);
    } else {
      setUsers(usersData ?? []);
    }

    const { data: loansData, error: loansError } = await supabase
      .from("loans")
      .select(
        "id, lender_id, borrower_id, amount, description, due_date, status, created_at"
      )
      .or(`lender_id.eq.${userId},borrower_id.eq.${userId}`)
      .in("status", ["active", "payment_pending"])
      .order("created_at", { ascending: false });

    if (loansError) {
      console.error("Error cargando préstamos:", loansError);
    } else {
      setLoans(loansData ?? []);
    }

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("loan_payments")
      .select(
        "id, loan_id, paid_by, amount, evidence_url, payer_confirmed, receiver_confirmed, created_at"
      )
      .order("created_at", { ascending: false });

    if (paymentsError) {
      console.error("Error cargando pagos:", paymentsError);
    } else {
      setPayments(paymentsData ?? []);
    }

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

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      alert("La cantidad debe ser mayor que 0.");
      return;
    }

    setSending(true);

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
      .insert([
        {
          loan_id: data.id,
          user_id: session.user.id,
          accepted: true,
          accepted_at: new Date().toISOString(),
        },
        {
          loan_id: data.id,
          user_id: selectedUser.id,
          accepted: false,
        },
      ]);

    if (acceptanceError) {
      console.error(acceptanceError);
      alert(
        "El préstamo se creó, pero hubo un problema registrando las aceptaciones."
      );
      setSending(false);
      return;
    }

    alert("¡Solicitud enviada!");

    setSelectedUser(null);
    setAmount("");
    setDescription("");
    setSending(false);

    await loadData();
  }

  function abrirRegistroPago(loan: Loan) {
    setPaymentLoan(loan);
    setPaymentAmount(String(loan.amount));
    setPaymentFile(null);
  }

  function cerrarRegistroPago() {
    if (paymentSending) return;

    setPaymentLoan(null);
    setPaymentAmount("");
    setPaymentFile(null);
  }

  async function registrarPago() {
    if (!paymentLoan) return;

    if (!paymentAmount) {
      alert("Indica la cantidad pagada.");
      return;
    }

    if (!paymentFile) {
      alert("Selecciona el comprobante del pago.");
      return;
    }

    const numericAmount = Number(paymentAmount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      alert("La cantidad pagada debe ser mayor que 0.");
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

    const maxSize = 5 * 1024 * 1024;

    if (paymentFile.size > maxSize) {
      alert("El comprobante no puede pesar más de 5 MB.");
      return;
    }

    if (!currentUserId) {
      alert("Tu sesión ha expirado.");
      return;
    }

    setPaymentSending(true);

    try {
      const extension =
        paymentFile.name.split(".").pop()?.toLowerCase() || "file";

      const filePath = `${currentUserId}/${paymentLoan.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-evidence")
        .upload(filePath, paymentFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: paymentFile.type,
        });

      if (uploadError) {
        console.error(uploadError);
        alert("No se pudo subir el comprobante: " + uploadError.message);
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

        await supabase.storage
          .from("payment-evidence")
          .remove([filePath]);

        alert("No se pudo registrar el pago: " + paymentError.message);
        setPaymentSending(false);
        return;
      }

      const { error: loanError } = await supabase
        .from("loans")
        .update({
          status: "payment_pending",
        })
        .eq("id", paymentLoan.id);

      if (loanError) {
        console.error(loanError);
        alert(
          "El pago fue registrado, pero no se pudo actualizar el estado del préstamo."
        );
        setPaymentSending(false);
        return;
      }

      alert(
        "¡Pago registrado! La otra persona deberá confirmar la recepción."
      );

      setPaymentLoan(null);
      setPaymentAmount("");
      setPaymentFile(null);
      setPaymentSending(false);

      await loadData();
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error inesperado al registrar el pago.");
      setPaymentSending(false);
    }
  }

  function obtenerNombreContraparte(loan: Loan) {
    if (loan.borrower_id === currentUserId) {
      const lender = users.find((user) => user.id === loan.lender_id);
      return lender?.full_name || lender?.email || "La otra persona";
    }

    const borrower = users.find((user) => user.id === loan.borrower_id);
    return borrower?.full_name || borrower?.email || "La otra persona";
  }

  function obtenerPago(loanId: string) {
    return payments.find((payment) => payment.loan_id === loanId);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <p>Cargando...</p>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-5">💰</div>

          <h1 className="text-3xl font-bold text-slate-900">
            Préstamos
          </h1>

          <p className="text-slate-500 mt-2 mb-8">
            Administra tus préstamos de forma sencilla.
          </p>

          <button
            onClick={loginWithGoogle}
            disabled={loginLoading}
            className="w-full rounded-2xl bg-slate-900 text-white py-4 font-semibold disabled:opacity-50"
          >
            {loginLoading ? "Conectando..." : "Continuar con Google"}
          </button>

          <p className="text-xs text-slate-400 mt-6">
            Acceso exclusivo para usuarios autorizados.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white rounded-3xl shadow-lg p-6">
          <h1 className="text-2xl font-bold">Bienvenido 👋</h1>

          <p className="text-slate-500 mt-2">{email}</p>
        </div>

        {/* PRÉSTAMOS ACTIVOS */}
        <div className="bg-white rounded-3xl shadow-lg p-6">
          <h2 className="text-xl font-bold">Mis préstamos</h2>

          <p className="text-slate-500 mt-2 mb-5">
            Aquí aparecerán tus préstamos activos y sus pagos.
          </p>

          {loans.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-center">
              <p className="text-slate-500">
                No tienes préstamos activos.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {loans.map((loan) => {
                const payment = obtenerPago(loan.id);
                const isBorrower = loan.borrower_id === currentUserId;

                return (
                  <div
                    key={loan.id}
                    className="border rounded-2xl p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-500">
                          {isBorrower ? "Le debes a" : "Te debe"}
                        </p>

                        <p className="font-semibold mt-1">
                          {obtenerNombreContraparte(loan)}
                        </p>
                      </div>

                      <p className="text-xl font-bold">
                        ${Number(loan.amount).toFixed(2)}
                      </p>
                    </div>

                    {loan.description && (
                      <p className="text-sm text-slate-500 mt-3">
                        {loan.description}
                      </p>
                    )}

                    <div className="mt-4">
                      {loan.status === "active" && !payment && isBorrower && (
                        <button
                          onClick={() => abrirRegistroPago(loan)}
                          className="w-full bg-slate-900 text-white rounded-2xl py-3 font-semibold"
                        >
                          Registrar pago
                        </button>
                      )}

                      {loan.status === "active" && !payment && !isBorrower && (
                        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                          El pago todavía no ha sido registrado.
                        </div>
                      )}

                      {loan.status === "payment_pending" && (
                        <div className="rounded-2xl bg-amber-50 p-4">
                          <p className="font-semibold text-amber-900">
                            Pago pendiente de confirmación
                          </p>

                          {payment && (
                            <p className="text-sm text-amber-800 mt-1">
                              Pago registrado por $
                              {Number(payment.amount).toFixed(2)}.
                            </p>
                          )}

                          {!isBorrower && (
                            <button
                              type="button"
                              className="mt-3 w-full rounded-2xl border border-amber-300 bg-white py-3 font-semibold text-amber-900"
                              onClick={() =>
                                alert(
                                  "El siguiente paso será confirmar la recepción del pago."
                                )
                              }
                            >
                              Confirmar recepción
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SOLICITAR PRÉSTAMO */}
        {!selectedUser ? (
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-xl font-bold">Solicitar préstamo</h2>

            <p className="text-slate-500 mt-2 mb-5">
              Elige a la persona a quien quieres solicitarle dinero.
            </p>

            {users.length === 0 ? (
              <p className="text-slate-500">
                Todavía no hay otros usuarios registrados.
              </p>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="w-full text-left border rounded-2xl p-4 hover:bg-slate-50"
                  >
                    <p className="font-semibold">
                      {user.full_name || "Usuario"}
                    </p>

                    <p className="text-sm text-slate-500">
                      {user.email}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <button
              onClick={() => setSelectedUser(null)}
              className="text-sm text-slate-500 mb-5"
            >
              ← Cambiar persona
            </button>

            <h2 className="text-xl font-bold">
              Solicitar préstamo
            </h2>

            <p className="mt-2 mb-6">
              Para:{" "}
              <strong>
                {selectedUser.full_name || selectedUser.email}
              </strong>
            </p>

            <label className="block text-sm font-medium mb-2">
              Cantidad
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej. 500"
              className="w-full border rounded-2xl p-4 mb-5"
            />

            <label className="block text-sm font-medium mb-2">
              Motivo
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Para qué necesitas el préstamo?"
              rows={4}
              className="w-full border rounded-2xl p-4 mb-5"
            />

            <button
              onClick={solicitarPrestamo}
              disabled={sending}
              className="w-full bg-slate-900 text-white rounded-2xl py-4 font-semibold disabled:opacity-50"
            >
              {sending ? "Enviando..." : "Enviar solicitud"}
            </button>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR PAGO */}
      {paymentLoan && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Registrar pago</h2>

              <button
                type="button"
                onClick={cerrarRegistroPago}
                disabled={paymentSending}
                className="text-slate-500 text-2xl"
              >
                ×
              </button>
            </div>

            <p className="text-slate-500 mt-2">
              Registra el pago y adjunta el comprobante.
            </p>

            <div className="rounded-2xl bg-slate-50 p-4 mt-5">
              <p className="text-sm text-slate-500">
                Préstamo
              </p>

              <p className="text-2xl font-bold mt-1">
                ${Number(paymentLoan.amount).toFixed(2)}
              </p>
            </div>

            <label className="block text-sm font-medium mt-5 mb-2">
              Cantidad pagada
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full border rounded-2xl p-4"
              placeholder="Ej. 500"
            />

            <label className="block text-sm font-medium mt-5 mb-2">
              Comprobante
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) =>
                setPaymentFile(e.target.files?.[0] ?? null)
              }
              className="w-full border rounded-2xl p-3 text-sm"
            />

            {paymentFile && (
              <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm">
                <p className="font-medium">
                  {paymentFile.name}
                </p>

                <p className="text-slate-500 mt-1">
                  {(paymentFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            <p className="text-xs text-slate-400 mt-4">
              Formatos permitidos: JPG, PNG, WEBP o PDF. Máximo 5 MB.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={cerrarRegistroPago}
                disabled={paymentSending}
                className="rounded-2xl border py-4 font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={registrarPago}
                disabled={paymentSending}
                className="rounded-2xl bg-slate-900 text-white py-4 font-semibold disabled:opacity-50"
              >
                {paymentSending
                  ? "Subiendo..."
                  : "Enviar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}