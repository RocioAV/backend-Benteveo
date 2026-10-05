export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible =
    local.length <= 2
      ? `${local[0] ?? ''}*`
      : `${local[0]}***${local[local.length - 1]}`;
  return `${visible}${domain}`;
}

export function maskDni(dni: string): string {
  const digits = dni.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(Math.max(1, digits.length));
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}
