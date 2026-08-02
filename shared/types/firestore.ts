/**
 * Tipos base do Firestore compartilhados entre cliente, Nitro e Cloud Functions.
 *
 * Por que não importar `Timestamp` do SDK aqui?
 * O SDK web (`firebase/firestore`) e o Admin SDK (`firebase-admin/firestore`)
 * exportam classes `Timestamp` diferentes e incompatíveis nominalmente. Se este
 * arquivo importasse uma delas, todo consumidor do outro lado passaria a carregar
 * o SDK errado no bundle.
 *
 * A solução é um tipo *estrutural*: as duas classes satisfazem esta interface,
 * então os modelos funcionam nos três ambientes sem nenhum import de SDK.
 */
export interface FsTimestamp {
  seconds: number
  nanoseconds: number
  toDate(): Date
  toMillis(): number
}

/** Documento serializado para JSON (respostas de API): timestamps viram ISO string. */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends FsTimestamp
    ? string
    : T[K] extends FsTimestamp | null
      ? string | null
      : T[K] extends object
        ? Serialized<T[K]>
        : T[K]
}

/** Campos de auditoria presentes em todo documento. */
export interface Auditable {
  createdAt: FsTimestamp
  updatedAt: FsTimestamp
}

/** Documento com exclusão lógica — nunca apagamos histórico de verdade. */
export interface SoftDeletable {
  deletedAt: FsTimestamp | null
}
