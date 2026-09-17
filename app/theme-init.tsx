'use client'

import { useEffect } from 'react'

export default function ThemeInit() {
  useEffect(() => {
    const saved = window.localStorage.getItem('theme') || window.localStorage.getItem('crm-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = saved === 'dark' || (!saved && prefersDark)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [])
  return null
}
