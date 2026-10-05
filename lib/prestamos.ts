import { createClient } from "./supabase";

export async function registrarPrestamo(params: {
  borrowerId: string;
  amount: number;
  description: string;
  dueDate: string | null;
}) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No hay una sesión activa.");
  }

  if (params.borrowerId === session.user.id) {
    throw new Error("No puedes registrarte un préstamo a ti mismo.");
  }

  const { data, error } = await supabase
    .from("loans")
    .insert({
      lender_id: session.user.id,
      borrower_id: params.borrowerId,
      amount: params.amount,
      description: params.description || null,
      due_date: params.dueDate,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;

  const { error: acceptanceError } = await supabase
    .from("loan_acceptances")
    .insert({
      loan_id: data.id,
      user_id: session.user.id,
      accepted: true,
      accepted_at: new Date().toISOString(),
    });

  if (acceptanceError) throw acceptanceError;

  return data;
}

export async function responderSolicitud(
  loanId: string,
  aceptar: boolean
) {
  const supabase = createClient();

  const { error } = await supabase.rpc(
    "responder_solicitud_prestamo",
    {
      p_loan_id: loanId,
      p_aceptar: aceptar,
    }
  );

  if (error) throw error;
}

export async function confirmarRecepcion(loanId: string) {
  const supabase = createClient();

  const { error } = await supabase.rpc(
    "confirmar_recepcion_pago",
    {
      p_loan_id: loanId,
    }
  );

  if (error) throw error;
}

export async function registrarPago(params: {
  loanId: string;
  userId: string;
  amount: number;
  file: File;
}) {
  const supabase = createClient();

  if (!params.file) {
    throw new Error("Debes seleccionar un comprobante.");
  }

  const maxSize = 10 * 1024 * 1024;

  if (params.file.size > maxSize) {
    throw new Error("El comprobante debe pesar máximo 10 MB.");
  }

  const extension =
    params.file.name.split(".").pop()?.toLowerCase() || "jpg";

  const filePath = `${params.userId}/${params.loanId}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-evidence")
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

  const { error: paymentError } = await supabase
    .from("loan_payments")
    .insert({
      loan_id: params.loanId,
      paid_by: params.userId,
      amount: params.amount,
      evidence_url: filePath,
      payer_confirmed: true,
      receiver_confirmed: false,
    });

  if (paymentError) {
    await supabase.storage
      .from("payment-evidence")
      .remove([filePath]);

    throw paymentError;
  }

  const { error: loanError } = await supabase
    .from("loans")
    .update({
      status: "payment_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.loanId);

  if (loanError) {
    throw loanError;
  }

  return {
    evidencePath: filePath,
  };
}

export async function verComprobante(path: string) {
  const supabase = createClient();

  if (!path) {
    throw new Error("No hay comprobante para mostrar.");
  }

  const { data, error } = await supabase.storage
    .from("payment-evidence")
    .createSignedUrl(path, 60 * 10);

  if (error) {
    throw new Error(
      `No se pudo abrir el comprobante: ${error.message}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error("No se pudo generar el enlace del comprobante.");
  }

  return data.signedUrl;
}