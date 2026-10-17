import { redirect } from 'next/navigation';

export default function SystemStatusPage() {
  redirect('/system-health');
}
