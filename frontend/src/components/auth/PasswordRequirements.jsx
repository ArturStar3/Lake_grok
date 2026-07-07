import { checkPasswordRequirements } from '../../utils/passwordPolicy';
import './PasswordRequirements.css';

export default function PasswordRequirements({ password = '' }) {
  const checks = checkPasswordRequirements(password);

  return (
    <ul className="password-requirements" aria-label="Требования к паролю">
      {checks.map((item) => (
        <li
          key={item.id}
          className={`password-requirements__item${item.met ? ' password-requirements__item--met' : ''}`}
        >
          <span className="password-requirements__mark" aria-hidden>
            {item.met ? '✓' : '○'}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
