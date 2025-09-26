import { NextRequest, NextResponse } from 'next/server'
import { sendQueryNotificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Webhook received:', body)

    // If a record-like payload is provided, attempt to send an email (optional test path)
    if (body && body.record) {
      try {
        const result = await sendQueryNotificationEmail(body.record)
        return NextResponse.json({ success: true, message: 'Webhook received successfully', receivedData: body, messageId: result.id })
      } catch (e) {
        console.warn('Optional email send failed in test-webhook:', e)
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook received successfully', receivedData: body })

  } catch (error: any) {
    console.error('Error in webhook:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
