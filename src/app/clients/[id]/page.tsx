'use client'

import { useParams, useRouter } from 'next/navigation'
import ClientProfilePanel from '@/components/ClientProfilePanel'

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  return <ClientProfilePanel clientId={id} onBack={() => router.back()} />
}
