//Helper functions that make CSS styling work better (combines different style rules)

import { clsx } from "clsx" // Combine class name strings conditionally
import { twMerge } from "tailwind-merge" // Merge Tailwind CSS classes without duplicates

//______________________________________________________
// CLASSNAME HELPER FUNCTION
// Join CSS class names and merge Tailwind classes neatly
export function cn(...inputs) {
    // clsx builds a single class string from inputs, then twMerge removes duplicate Tailwind classes
    return twMerge(clsx(inputs))
}
