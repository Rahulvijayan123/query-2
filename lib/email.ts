interface QueryFacets {
  target?: string
  indication?: string
  modality?: string
  geography?: string
  stage?: string
  exclusions?: string
  timeWindow?: string
  additionalInfo?: string
}

export interface QueryRecordLike {
  email?: string
  facets?: string | QueryFacets | null
  query_text?: string | null
  created_at?: string | Date | null
}

function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error("RESEND_API_KEY not found")
  }
  return key
}

function coerceFacets(facets: QueryRecordLike["facets"]): QueryFacets {
  if (!facets) return {}
  if (typeof facets === "string") {
    try {
      return JSON.parse(facets) as QueryFacets
    } catch {
      return {}
    }
  }
  return facets
}

function formatCreatedAt(createdAt: QueryRecordLike["created_at"]): string {
  try {
    const d = createdAt ? new Date(createdAt) : new Date()
    return d.toLocaleString()
  } catch {
    return new Date().toLocaleString()
  }
}

export async function sendQueryNotificationEmail(record: QueryRecordLike): Promise<{ id: string }> {
  const RESEND_API_KEY = getResendApiKey()

  const toEmail = "ayaan@convexia.bio"
  const fromEmail = "onboarding@resend.dev"

  const facets = coerceFacets(record.facets)

  const html = `
    <h2>New Query Submitted to Convexia</h2>
    <p><strong>Email:</strong> ${record.email || "Not provided"}</p>
    <p><strong>Target:</strong> ${facets.target || "Not specified"}</p>
    <p><strong>Indication:</strong> ${facets.indication || "Not specified"}</p>
    <p><strong>Modality:</strong> ${facets.modality || "Not specified"}</p>
    <p><strong>Geography:</strong> ${facets.geography || "Not specified"}</p>
    <p><strong>Stage:</strong> ${facets.stage || "Not specified"}</p>
    <p><strong>Exclusions:</strong> ${facets.exclusions || "Not specified"}</p>
    <p><strong>Time Window:</strong> ${facets.timeWindow || "Not specified"}</p>
    <p><strong>Additional Info:</strong> ${facets.additionalInfo || "Not provided"}</p>
    <p><strong>Full Query:</strong> ${record.query_text || "Not provided"}</p>
    <p><strong>Submitted:</strong> ${formatCreatedAt(record.created_at)}</p>
    <hr>
    <p><em>This is an automated notification from your Convexia demo app.</em></p>
  `

  const emailData = {
    from: fromEmail,
    to: [toEmail],
    subject: `New Query Submitted - ${record.email || "No Email"}`,
    html,
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailData),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${error}`)
  }

  const result = (await response.json()) as { id: string }
  return result
}

export async function sendTestEmail(toEmail = "ayaan@convexia.bio"): Promise<{ id: string }> {
  const RESEND_API_KEY = getResendApiKey()
  const fromEmail = "onboarding@resend.dev"

  const emailData = {
    from: fromEmail,
    to: [toEmail],
    subject: "Test Email from Convexia",
    html: `
      <h2>Test Email</h2>
      <p>This is a test email to verify Resend is working.</p>
      <p>Sent at: ${new Date().toLocaleString()}</p>
    `,
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailData),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${error}`)
  }

  const result = (await response.json()) as { id: string }
  return result
}


