export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS = [
  {
    id: 'length',
    label: `Не менее ${PASSWORD_MIN_LENGTH} символов`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'upper',
    label: 'Заглавная буква',
    test: (password) => /[A-ZА-ЯЁ]/.test(password),
  },
  {
    id: 'lower',
    label: 'Строчная буква',
    test: (password) => /[a-zа-яё]/.test(password),
  },
  {
    id: 'digit',
    label: 'Цифра',
    test: (password) => /\d/.test(password),
  },
];

export function checkPasswordRequirements(password = '') {
  return PASSWORD_REQUIREMENTS.map((req) => ({
    ...req,
    met: req.test(password),
  }));
}

export function isPasswordValid(password = '') {
  return PASSWORD_REQUIREMENTS.every((req) => req.test(password));
}

export function passwordStrength(password = '') {
  const checks = checkPasswordRequirements(password);
  const met = checks.filter((item) => item.met).length;
  const total = checks.length;
  const score = met;
  const ratio = met / total;
  let label = 'Слабый';
  if (ratio >= 1) label = 'Надёжный';
  else if (ratio >= 0.8) label = 'Хороший';
  else if (ratio >= 0.6) label = 'Средний';
  return { score, maxScore: total, label, checks };
}

export const PASSWORD_POLICY_HINT =
  'Пароль: не менее 8 символов, заглавные и строчные буквы, цифра.';
