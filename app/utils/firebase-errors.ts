/**
 * Traduz códigos de erro do Firebase em mensagens acionáveis, em português.
 *
 * Mostrar `auth/invalid-credential` para quem só quer entrar na conta é o tipo
 * de detalhe que destrói a confiança no produto. Cada mensagem aqui responde
 * "o que eu faço agora?", não apenas "o que deu errado".
 */
const MESSAGES: Record<string, string> = {
  // --- Autenticação ---
  'auth/invalid-email': 'E-mail inválido. Confira se digitou corretamente.',
  'auth/user-disabled': 'Esta conta foi desativada. Fale com o suporte.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  // Código atual do SDK: unifica usuário inexistente e senha errada. Não
  // separamos os dois na mensagem — isso permitiria descobrir quais e-mails
  // têm conta no serviço.
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Tente entrar.',
  'auth/weak-password': 'Senha muito fraca. Use pelo menos 8 caracteres.',
  'auth/missing-password': 'Digite sua senha.',
  'auth/too-many-requests':
    'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Falha de conexão. Verifique sua internet e tente de novo.',
  'auth/operation-not-allowed':
    'Este método de login não está habilitado no projeto Firebase.',
  'auth/requires-recent-login': 'Por segurança, entre novamente para concluir esta ação.',
  'auth/unauthorized-domain':
    'Domínio não autorizado no Firebase Authentication. Adicione-o em Authentication → Settings.',

  // --- Login social ---
  'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
  'auth/cancelled-popup-request': 'Outra janela de login já estava aberta.',
  'auth/popup-blocked':
    'Seu navegador bloqueou a janela do Google. Libere os pop-ups para este site.',
  'auth/account-exists-with-different-credential':
    'Este e-mail já foi cadastrado com outro método. Entre com e-mail e senha.',

  // --- Firestore ---
  'permission-denied': 'Você não tem permissão para acessar estes dados.',
  unavailable: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  'not-found': 'Registro não encontrado.',
  'resource-exhausted': 'Limite de uso atingido. Tente novamente mais tarde.',
  'failed-precondition':
    'Consulta requer um índice que ainda não existe. Verifique o console do Firestore.',

  // --- Storage ---
  'storage/unauthorized': 'Você não tem permissão para acessar este arquivo.',
  'storage/canceled': 'Envio cancelado.',
  'storage/quota-exceeded': 'Limite de armazenamento atingido.',
  'storage/retry-limit-exceeded': 'O envio demorou demais. Verifique sua conexão e tente de novo.',
  'storage/unauthenticated': 'Sessão expirada. Entre novamente.',
}

const FALLBACK = 'Algo deu errado. Tente novamente em instantes.'

function extractCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    if (typeof code === 'string') return code
  }
  return null
}

/** Mensagem pronta para exibir ao usuário. */
export function firebaseErrorMessage(error: unknown): string {
  const code = extractCode(error)
  if (code && MESSAGES[code]) return MESSAGES[code]

  if (import.meta.dev && code) {
    console.warn(`[firebase] código de erro sem tradução: ${code}`, error)
  }
  return FALLBACK
}

/** Fechar o pop-up do Google não é falha — não deve virar toast de erro. */
export function isUserCancelledError(error: unknown): boolean {
  const code = extractCode(error)
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled'
  )
}

export function isPermissionDeniedError(error: unknown): boolean {
  return extractCode(error) === 'permission-denied'
}
