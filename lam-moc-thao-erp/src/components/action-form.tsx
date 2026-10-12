'use client'

import { useActionState, type ReactNode } from 'react'
import type { ActionState } from '@/lib/action'
import { buttonClass } from './ui'
import { cn } from '@/lib/cn'

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  children?: ReactNode
  submitLabel: string
  pendingLabel?: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'md' | 'sm'
  className?: string
  /** Hộp xác nhận trước khi gửi */
  confirm?: string
  inline?: boolean
}

export function ActionForm({ action, children, submitLabel, pendingLabel = 'Đang xử lý...', variant = 'primary', size = 'md', className, confirm, inline }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)
  return (
    <form
      action={formAction}
      className={cn(inline ? 'inline-flex flex-wrap items-center gap-2' : 'space-y-4', className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
    >
      {children}
      <div className={cn('flex flex-wrap items-center gap-3', inline && 'contents')}>
        <button type="submit" disabled={pending} className={buttonClass(variant, size)}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}
        {state?.ok && <p className="text-sm font-medium text-emerald-700">{state.ok}</p>}
      </div>
    </form>
  )
}
