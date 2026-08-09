'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { explorerUrl } from '@/lib/config'

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'pending'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type Toast = {
  id: string
  kind: ToastKind
  title?: string
  message: string
  hash?: string
  durationMs: number
  action?: ToastAction
  onClose?: () => void
}

export type ToastInput = {
  kind?: ToastKind
  title?: string
  message: string
  hash?: string
  durationMs?: number
  action?: ToastAction
  onClose?: () => void
}

export type ToastApi = {
  push: (input: ToastInput) => string
  dismiss: (id: string) => void
  success: (message: string, opts?: Omit<ToastInput, 'message' | 'kind'>) => string
  error: (message: string, opts?: Omit<ToastInput, 'message' | 'kind'>) => string
  info: (message: string, opts?: Omit<ToastInput, 'message' | 'kind'>) => string
  warning: (message: string, opts?: Omit<ToastInput, 'message' | 'kind'>) => string
  pending: (message: string, opts?: Omit<ToastInput, 'message' | 'kind'>) => string
}

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 6_000,
  error: 10_000,
  info: 6_000,
  warning: 8_000,
  pending: 12_000,
}

const ToastActionsContext = createContext<ToastApi | null>(null)

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

function toastFingerprint(input: ToastInput & { kind: ToastKind }): string {
  return `${input.kind}|${input.title ?? ''}|${input.message}|${input.hash ?? ''}`
}

const noop = () => ''
const noopApi: ToastApi = {
  push: noop,
  dismiss: () => {},
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
  pending: noop,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastsRef = useRef<Toast[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    toastsRef.current = toasts
  }, [toasts])

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id)
      target?.onClose?.()
      return prev.filter((t) => t.id !== id)
    })
  }, [])

  const scheduleDismiss = useCallback(
    (id: string, durationMs: number) => {
      const existing = timersRef.current.get(id)
      if (existing) clearTimeout(existing)
      const timer = window.setTimeout(() => dismiss(id), durationMs)
      timersRef.current.set(id, timer)
    },
    [dismiss],
  )

  const push = useCallback(
    (input: ToastInput): string => {
      const kind = input.kind ?? 'info'
      const durationMs = input.durationMs ?? DEFAULT_DURATION[kind]
      const fingerprint = toastFingerprint({ ...input, kind })

      const duplicate = toastsRef.current.find(
        (t) => toastFingerprint(t) === fingerprint,
      )
      if (duplicate) {
        scheduleDismiss(duplicate.id, durationMs)
        return duplicate.id
      }

      const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const toast: Toast = { ...input, kind, id, durationMs }

      setToasts((prev) => [...prev.slice(-4), toast])
      scheduleDismiss(id, durationMs)
      return id
    },
    [scheduleDismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (message, opts) => push({ ...opts, kind: 'success', message }),
      error: (message, opts) => push({ ...opts, kind: 'error', message }),
      info: (message, opts) => push({ ...opts, kind: 'info', message }),
      warning: (message, opts) => push({ ...opts, kind: 'warning', message }),
      pending: (message, opts) => push({ ...opts, kind: 'pending', message }),
    }),
    [push, dismiss],
  )

  return (
    <ToastActionsContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastActionsContext.Provider>
  )
}

export function useToast(): ToastApi {
  return useContext(ToastActionsContext) ?? noopApi
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-viewport" role="status" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`}>
          <div className="toast__body">
            {toast.title && <p className="toast__title">{toast.title}</p>}
            <p className="toast__message">{toast.message}</p>
            {toast.hash && (
              <p className="toast__hash">
                <a href={`${explorerUrl}/tx/${toast.hash}`} target="_blank" rel="noreferrer">
                  {shortHash(toast.hash)} →
                </a>
              </p>
            )}
            {toast.action && (
              <button type="button" className="toast__action" onClick={toast.action.onClick}>
                {toast.action.label}
              </button>
            )}
          </div>
          <button
            type="button"
            className="toast__dismiss"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
