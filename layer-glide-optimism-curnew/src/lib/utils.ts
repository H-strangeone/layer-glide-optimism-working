import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
<<<<<<< HEAD
export { formatAddress } from '@/lib/format';
=======
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
