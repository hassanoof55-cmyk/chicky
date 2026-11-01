export async function getVerifiedAdmin(client: any) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  const role = await client.rpc('is_chicky_admin');
  if (role.error || role.data !== true) return null;
  return data.user;
}

export async function signInAdmin(client: any, email: string, password: string) {
  if (!email.trim() || !password) throw new Error('اكتب الإيميل وكلمة السر');
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data?.user) throw new Error('الإيميل أو كلمة السر غير صحيحة');
  try {
    const user = await getVerifiedAdmin(client);
    if (!user) throw new Error('غير مسموح لهذا الحساب بدخول الإدارة');
    return user;
  } catch (error) {
    await client.auth.signOut();
    throw error;
  }
}
