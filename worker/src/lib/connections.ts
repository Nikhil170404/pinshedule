import { db } from './clients'
import { NotConnectedError } from './tokens'
import { ServiceError } from './service-error'

export interface ConnectionInfo { id: string; username: string | null; status: string; is_primary: boolean; pinterest_user_id: string }

export async function listConnections(userId: string): Promise<ConnectionInfo[]> {
  const { data } = await db.from('pinterest_connections').select('id, pinterest_username, status, is_primary, pinterest_user_id')
    .eq('user_id', userId).order('is_primary', { ascending: false }).order('created_at', { ascending: true })
  return (data ?? []).map((c) => ({ id: c.id as string, username: c.pinterest_username as string | null, status: c.status as string, is_primary: !!c.is_primary, pinterest_user_id: c.pinterest_user_id as string }))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The Pinterest account an action applies to. No id means the primary account. An id that does not belong
 * to this user is rejected, so one customer can never act on another's account.
 */
export async function resolveConnection(userId: string, requested?: string | null): Promise<string> {
  const all = await listConnections(userId)
  if (all.length === 0) throw new NotConnectedError('Pinterest is not connected. Reconnect your account.')
  if (!requested) return all[0].id
  if (!UUID.test(requested) || !all.some((c) => c.id === requested)) throw new ServiceError('That Pinterest account is not connected to your login.', 400)
  return requested
}
