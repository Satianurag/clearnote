'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/context/ToastContext'

function toastKey(message: string, title?: string) {
  return `${title ?? ''}\0${message}`
}

/** Show a toast when `error` becomes non-null (deduped per message+title). */
export function useErrorToast(error: string | null | undefined, title?: string) {
  const { error: showError } = useToast()
  const shownKey = useRef<string | null>(null)

  useEffect(() => {
    if (!error) {
      shownKey.current = null
      return
    }
    const key = toastKey(error, title)
    if (shownKey.current === key) return
    shownKey.current = key
    showError(error, title ? { title } : undefined)
  }, [error, title, showError])
}

/** Show a success toast once when `message` is set. */
export function useSuccessToast(message: string | null | undefined) {
  const { success } = useToast()
  const shownKey = useRef<string | null>(null)

  useEffect(() => {
    if (!message) {
      shownKey.current = null
      return
    }
    if (shownKey.current === message) return
    shownKey.current = message
    success(message)
  }, [message, success])
}
