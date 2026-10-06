import { createClient } from "./supabase";

type ParticipanteGasto = {
  user_id: string;
  amount: number;
};

export async function crearGastoCompartido(params: {
  title: string;
  description: string | null;
  totalAmount: number;
  participants: ParticipanteGasto[];
}) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("crear_gasto_compartido", {
    p_title: params.title,
    p_description: params.description,
    p_total_amount: params.totalAmount,
    p_participants: params.participants,
  });

  if (error) throw error;
  return data;
}

export async function editarGastoCompartido(params: {
  expenseId: string;
  title: string;
  description: string | null;
  totalAmount: number;
  participants: ParticipanteGasto[];
}) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("editar_gasto_compartido", {
    p_expense_id: params.expenseId,
    p_title: params.title,
    p_description: params.description,
    p_total_amount: params.totalAmount,
    p_participants: params.participants,
  });

  if (error) throw error;
  return data;
}

export async function eliminarGastoCompartido(expenseId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("eliminar_gasto_compartido", {
    p_expense_id: expenseId,
  });

  if (error) throw error;
  return data;
}

export async function responderGastoCompartido(
  expenseId: string,
  aceptar: boolean
) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("responder_gasto_compartido", {
    p_expense_id: expenseId,
    p_aceptar: aceptar,
  });

  if (error) throw error;
  return data;
}

export async function registrarPagoGastoCompartido(params: {
  expenseId: string;
  amount: number;
  file: File;
}) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No hay una sesión activa.");
  }

  if (!params.file) {
    throw new Error("Debes seleccionar un comprobante.");
  }

  if (params.file.size > 10 * 1024 * 1024) {
    throw new Error("El comprobante debe pesar máximo 10 MB.");
  }

  const extension =
    params.file.name.split(".").pop()?.toLowerCase() || "jpg";

  const filePath = `${session.user.id}/${params.expenseId}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("shared-expense-payment-evidence")
    .upload(filePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || "application/octet-stream",
    });

  if (uploadError) {
    throw new Error(
      `No se pudo subir el comprobante: ${uploadError.message}`
    );
  }

  const { data, error } = await supabase.rpc(
    "registrar_pago_gasto_compartido",
    {
      p_expense_id: params.expenseId,
      p_amount: params.amount,
      p_evidence_url: filePath,
    }
  );

  if (error) {
    await supabase.storage
      .from("shared-expense-payment-evidence")
      .remove([filePath]);

    throw error;
  }

  return data;
}

export async function confirmarPagoGastoCompartido(
  expenseId: string,
  participantUserId: string
) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc(
    "confirmar_pago_gasto_compartido",
    {
      p_expense_id: expenseId,
      p_participant_user_id: participantUserId,
    }
  );

  if (error) throw error;
  return data;
}

export async function verComprobanteGastoCompartido(
  path: string | null
) {
  if (!path) {
    throw new Error("Este pago no tiene comprobante.");
  }

  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("shared-expense-payment-evidence")
    .createSignedUrl(path, 60 * 10);

  if (error) {
    throw new Error(
      `No se pudo abrir el comprobante: ${error.message}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error("No se pudo generar el enlace.");
  }

  return data.signedUrl;
}

export async function rechazarPagoGastoCompartido(
  expenseId: string,
  participantUserId: string
) {
  const supabase = createClient();

  const { error } = await supabase.rpc("rechazar_pago_gasto_compartido", {
    p_expense_id: expenseId,
    p_participant_user_id: participantUserId,
  });

  if (error) throw error;
}