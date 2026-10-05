"use client";

import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      setEmail(session.user.email ?? null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("is_active", true)
        .neq("id", session.user.id);

      if (error) {
        console.error(error);
      } else {
        setUsers(data ?? []);
      }

      setLoading(false);
    }

    loadData();
  }, []);

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

    await supabase.from("loan_acceptances").insert([
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

    alert("¡Solicitud enviada!");

    setSelectedUser(null);
    setAmount("");
    setDescription("");
    setSending(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>No has iniciado sesión.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-md mx-auto">

        <div className="bg-white rounded-3xl shadow-lg p-6">
          <h1 className="text-2xl font-bold">
            Bienvenido 👋
          </h1>

          <p className="text-slate-500 mt-2">
            {email}
          </p>
        </div>

        {!selectedUser ? (
          <div className="bg-white rounded-3xl shadow-lg p-6 mt-6">
            <h2 className="text-xl font-bold">
              Solicitar préstamo
            </h2>

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
          <div className="bg-white rounded-3xl shadow-lg p-6 mt-6">
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
    </main>
  );
}