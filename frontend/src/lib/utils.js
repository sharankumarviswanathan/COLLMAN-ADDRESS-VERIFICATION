/**
 * Class names combination utility
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
