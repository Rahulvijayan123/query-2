import { NextRequest, NextResponse } from 'next/server'
import { sendTestEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const to = 'ayaan@convexia.bio'
    console.log('Sending test email to:', to)
    const result = await sendTestEmail(to)
    console.log('Test email sent successfully:', result)
    return NextResponse.json({ success: true, messageId: result.id, message: 'Test email sent successfully' })

  } catch (error: any) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
