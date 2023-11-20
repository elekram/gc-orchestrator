import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'

export async function addUsersToStore(store: Store) {
  const auth = store.auth
  const users = await googleClassroom.listDirectoryUsers(auth)

  store.remote.activeUsers = users.activeUsers
  store.remote.suspendedUsers = users.suspendedUsers
}
