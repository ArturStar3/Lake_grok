const LEVEL_RANK = { none: 0, read: 1, write: 2 };

export function getPermissions(user) {
  return user?.permissions || null;
}

export function canReadModule(user, module) {
  const perms = getPermissions(user);
  if (!perms) return false;
  if (perms.is_superuser) return true;
  return LEVEL_RANK[perms.modules?.[module] || 'none'] >= LEVEL_RANK.read;
}

export function canWriteModule(user, module) {
  const perms = getPermissions(user);
  if (!perms) return false;
  if (perms.is_superuser) return true;
  return LEVEL_RANK[perms.modules?.[module] || 'none'] >= LEVEL_RANK.write;
}

export function canDelete(user) {
  const perms = getPermissions(user);
  if (!perms) return false;
  return Boolean(perms.is_superuser || perms.can_delete);
}

export function canManageReference(user) {
  const perms = getPermissions(user);
  if (!perms) return false;
  return Boolean(perms.is_superuser || perms.can_manage_reference);
}

export function canManageUsers(user) {
  const perms = getPermissions(user);
  if (!perms) return false;
  return Boolean(perms.is_superuser || perms.can_manage_users);
}

export function canApproveRegistrations(user) {
  const perms = getPermissions(user);
  if (!perms) return false;
  return Boolean(perms.is_superuser || perms.can_approve_registrations);
}

export function hasCountryAccess(user, countryId) {
  const perms = getPermissions(user);
  if (!perms) return false;
  if (perms.is_superuser || perms.allowed_country_ids == null) return true;
  if (countryId == null) return true;
  return perms.allowed_country_ids.includes(Number(countryId));
}

export { passwordStrength, isPasswordValid, PASSWORD_POLICY_HINT } from './passwordPolicy';
