import type { FirebaseLoader, FirebaseServices } from '~/plugins/firebase.client'

function loader(): FirebaseLoader {
  const { $firebase } = useNuxtApp()

  if (!$firebase) {
    throw new Error(
      'Firebase indisponível. O plugin é client-only — verifique se a rota está marcada como `ssr: false`.',
    )
  }
  return $firebase as FirebaseLoader
}

/**
 * Instâncias do Firebase, de forma síncrona.
 *
 * Só é seguro depois que o SDK carregou — na prática, dentro de qualquer código
 * que rode após um middleware de auth ou após `await useFirebaseAsync()`. Se
 * chamado antes, lança com uma mensagem que diz o que fazer, em vez de devolver
 * `undefined` e explodir três camadas adiante.
 */
export function useFirebase(): FirebaseServices {
  return loader().get()
}

/** Garante o carregamento do SDK e devolve as instâncias. */
export function useFirebaseAsync(): Promise<FirebaseServices> {
  return loader().load()
}
