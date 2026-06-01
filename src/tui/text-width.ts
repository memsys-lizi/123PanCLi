import stringWidth from 'string-width';

export function displayWidth(value: string): number {
  return stringWidth(value);
}

export function truncateDisplay(value: string, width: number): string {
  if (displayWidth(value) <= width) return value;
  let output = '';
  for (const char of value) {
    if (displayWidth(`${output}${char}…`) > width) break;
    output += char;
  }
  return `${output}…`;
}

export function padDisplayEnd(value: string, width: number): string {
  const truncated = truncateDisplay(value, width);
  return `${truncated}${' '.repeat(Math.max(0, width - displayWidth(truncated)))}`;
}

export function padDisplayStart(value: string, width: number): string {
  const truncated = truncateDisplay(value, width);
  return `${' '.repeat(Math.max(0, width - displayWidth(truncated)))}${truncated}`;
}
