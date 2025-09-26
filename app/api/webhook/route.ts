import { NextRequest, NextResponse } from 'next/server'
import { sendQueryNotificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { record } = body

    console.log('Record data:', record)
    const result = await sendQueryNotificationEmail(record)
    console.log('Email sent successfully:', result)
    return NextResponse.json({ success: true, messageId: result.id })

  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}