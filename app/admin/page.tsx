/**
 * /admin — redireciona pra /admin/users.
 * O layout já checa a role; aqui é só navegação.
 */
import { redirect } from 'next/navigation';

export default function AdminIndex() {
  redirect('/admin/users');
}
