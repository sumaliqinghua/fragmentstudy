export function resolveEmailDeliveryEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
