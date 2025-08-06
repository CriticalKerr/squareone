/**
 * This hook manages toast notifications (popup messages) across the application.
 * It provides a centralized state management system for showing success, error,
 * and info messages to users.
 *
 * Usage:
 * const { toast, dismiss } = useToast();
 * toast({ title: "Success!", description: "Property saved" });
 *
 * Used by: Toaster component (/components/ui/toaster.jsx)
 */

import * as React from "react"
//______________________________________________________
// TOAST SETTINGS
// Control how many toasts show at once and how long they last
const TOAST_LIMIT = 1 // Show only 1 toast at a time
const TOAST_REMOVE_DELAY = 1000000 // How long before we remove a toast automatically (ms)

//______________________________________________________
// ACTION TYPES
// Names for the different things we can do with toasts
const actionTypes = {
    ADD_TOAST: "ADD_TOAST",  // Create a new toast
    UPDATE_TOAST: "UPDATE_TOAST", // Change a toast that's already there
    DISMISS_TOAST: "DISMISS_TOAST", // Hide a toast but don’t remove it yet
    REMOVE_TOAST: "REMOVE_TOAST",// Remove a toast completely
}

//______________________________________________________
// ID GENERATOR
// Make a simple counter so each toast gets a unique string ID
let count = 0
function genId() {
    count = (count + 1) % Number.MAX_SAFE_INTEGER
    return count.toString()
}

//______________________________________________________
// REMOVE QUEUE HANDLER
// Keep track of timeouts so we can auto-remove toasts later
const toastTimeouts = new Map()

const addToRemoveQueue = (toastId) => {
    if (toastTimeouts.has(toastId)) return

    const timeout = setTimeout(() => {
        toastTimeouts.delete(toastId)
        dispatch({
            type: actionTypes.REMOVE_TOAST,
            toastId,
        })
    }, TOAST_REMOVE_DELAY)

    toastTimeouts.set(toastId, timeout)
}

//______________________________________________________
// REDUCER FUNCTION
// Decide how to change our toast list based on actions
export const reducer = (state, action) => {
    switch (action.type) {
        case actionTypes.ADD_TOAST:
            return {
                ...state,
                toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
            }

        case actionTypes.UPDATE_TOAST:
            return {
                ...state,
                toasts: state.toasts.map((t) =>
                    t.id === action.toast.id ? { ...t, ...action.toast } : t
                ),
            }

        case actionTypes.DISMISS_TOAST: {
            const { toastId } = action
            if (toastId) {
                addToRemoveQueue(toastId)
            } else {
                state.toasts.forEach((t) => addToRemoveQueue(t.id))
            }
            return {
                ...state,
                toasts: state.toasts.map((t) =>
                    toastId == null || t.id === toastId
                        ? { ...t, open: false }
                        : t
                ),
            }
        }

        case actionTypes.REMOVE_TOAST:
            if (action.toastId == null) {
                return { ...state, toasts: [] }
            }
            return {
                ...state,
                toasts: state.toasts.filter((t) => t.id !== action.toastId),
            }

        default:
            return state
    }
}

//______________________________________________________
// STATE MANAGEMENT
// Keep a list of listeners and the current toasts state
const listeners = []
let memoryState = { toasts: [] }

function dispatch(action) {
    memoryState = reducer(memoryState, action)
    listeners.forEach((listener) => listener(memoryState))
}

//______________________________________________________
// TOAST CREATOR
// Use this function to show a new toast and get helpers back
export function toast(props) {
    const id = genId()

    const update = (updateProps) =>
        dispatch({
            type: actionTypes.UPDATE_TOAST,
            toast: { ...updateProps, id },
        })

    const dismiss = () =>
        dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id })

    dispatch({
        type: actionTypes.ADD_TOAST,
        toast: {
            ...props,
            id,
            open: true,
        },
    })

    return { id, update, dismiss }
}

//______________________________________________________
// CUSTOM HOOK: useToast
// React hook to get toast list and functions in components
export function useToast() {
    const [state, setState] = React.useState(memoryState)

    React.useEffect(() => {
        listeners.push(setState)
        return () => {
            const idx = listeners.indexOf(setState)
            if (idx > -1) listeners.splice(idx, 1)
        }
    }, [])

    return {
        ...state,
        toast,
        dismiss: (toastId) =>
            dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
    }
}
