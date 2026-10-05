import { createClient } from "./supabase";

export async function crearGastoCompartido(params: {
  title: string;
  description: string | null;
  totalAmount: number;
  participants: {
    user_id: string;
    amount: number;
  }[];
}) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc(
    "crear_gasto_compartido",
    {
      p_title: params.title,
      p_description: params.description,
      p_total_amount: params.totalAmount,
      p_participants: params.participants,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function responderGastoCompartido(
  expenseId: string,
  aceptar: boolean
) {
  const supabase = createClient();

  const { error } = await supabase.rpc(
    "responder_gasto_compartido",
    {
      p_expense_id: expenseId,
      p_aceptar: aceptar,
    }
  );

  if (error) {
    throw error;
  }
}