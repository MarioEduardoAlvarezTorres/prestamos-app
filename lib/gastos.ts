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

export async function registrarPagoGastoCompartido(params: {
  participantId: string;
  amount: number;
  file: File;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Debes iniciar sesión");
  }

  const extension =
    params.file.name.split(".").pop()?.toLowerCase() || "bin";

  const fileName = `${crypto.randomUUID()}.${extension}`;

  const storagePath = `${user.id}/gastos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-evidence")
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || undefined,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase.rpc(
    "registrar_pago_gasto_compartido",
    {
      p_participant_id: params.participantId,
      p_amount: params.amount,
      p_evidence_url: storagePath,
    }
  );

  if (error) {
    await supabase.storage
      .from("payment-evidence")
      .remove([storagePath]);

    throw error;
  }

  return data;
}

export async function confirmarPagoGastoCompartido(
  participantId: string
) {
  const supabase = createClient();

  const { error } = await supabase.rpc(
    "confirmar_pago_gasto_compartido",
    {
      p_participant_id: participantId,
    }
  );

  if (error) {
    throw error;
  }
}

export async function verComprobanteGastoCompartido(
  evidencePath: string
) {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("payment-evidence")
    .createSignedUrl(evidencePath, 60 * 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}