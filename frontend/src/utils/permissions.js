const LEVEL_RANK = { none: 0, read: 1, write: 2, write_delete: 3 };

export function getPermissions(user) {
  if (!user) return null;
  const perms = user.permissions || null;
  if (user.is_superuser) {
    return { ...(perms || {}), is_superuser: true };
  }
  return perms;
}

function resolveModuleLevel(user, module) {
  const perms = getPermissions(user);
  if (!perms) return 'none';
  if (perms.is_superuser || user?.is_superuser) return 'write_delete';
  const modules = perms.modules || {};
  if (Object.prototype.hasOwnProperty.call(modules, module)) {
    return modules[module] || 'none';
  }
  // Старый бэкенд без поля demo_scenarios: те же права, что на объекты карты.
  if (module === 'demo_scenarios') return modules.targets || 'none';
  return 'none';
}

export function canReadModule(user, module) {
  return LEVEL_RANK[resolveModuleLevel(user, module)] >= LEVEL_RANK.read;
}

export function canWriteModule(user, module) {
  return LEVEL_RANK[resolveModuleLevel(user, module)] >= LEVEL_RANK.write;
}

export function canDeleteModule(user, module) {
  return LEVEL_RANK[resolveModuleLevel(user, module)] >= LEVEL_RANK.write_delete;
}

export function canManageReference(user) {
  const perms = getPermissions(user);
  if (!perms) return false;
  return Boolean(perms.is_superuser || user?.is_superuser || perms.can_manage_reference);
}

export function canManageUsers(user) {
  const perms = getPermissions(user);
  if (!perms) return false;
  return Boolean(perms.is_superuser || user?.is_superuser || perms.can_manage_users);
}

export function canApproveRegistrations(user) {
  const perms = getPermissions(user);
  if (!perms) return false;
  return Boolean(perms.is_superuser || user?.is_superuser || perms.can_approve_registrations);
}

export function hasCountryAccess(user, countryId) {
  const perms = getPermissions(user);
  if (!perms) return false;
  if (perms.is_superuser || user?.is_superuser || perms.allowed_country_ids == null) return true;
  if (countryId == null) return true;
  return perms.allowed_country_ids.includes(Number(countryId));
}

export { passwordStrength, isPasswordValid, PASSWORD_POLICY_HINT } from './passwordPolicy';
